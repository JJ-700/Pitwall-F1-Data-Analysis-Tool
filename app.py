from flask import Flask, render_template, request, jsonify
import fastf1
from fastf1.ergast import Ergast
import plotly.graph_objs as go
import pandas as pd
import secrets
from circuit_database import CIRCUIT_DATABASE

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)  # Generate a random secret key
plotly_template = 'plotly_dark'  # Default template

import fastf1.plotting
fastf1.plotting.setup_mpl(
    mpl_timedelta_support=True,
    color_scheme='fastf1',
    misc_mpl_mods=False
)
#potentially add top3 most recent as statup graphs

# Caching location is autoselected based on the OS and is autoscanned by FastF1 when retreiving data.

#/////////////HELPER FUNCTIONS BELOW////////////////////
def get_teammates(session):
    """Returns a dict mapping team names to their drivers"""
    teams = {}
    for driver in session.drivers:
        try:
            info = session.get_driver(driver)
            team = info['TeamName']
            if team not in teams:
                teams[team] = []
            teams[team].append(driver)
        except:
            continue
    return teams

def normalize_team_name(name):
    """Apply your special Racing Bulls → RB rule."""
    return "RB" if name == "Racing Bulls" else name

def get_driver_color(team_name,session):
    """Get a safe team colour, defaulting to white on error, with special case for HAAS / RBR."""
    try:
        if team_name == 'Haas F1 Team':
            return '#c4c4c4'  # Light grey for HAAS
        if team_name == 'Red Bull Racing':
            return '#fcd700' # Yellow for Red Bull Racing
        return fastf1.plotting.get_team_color(team_name, session=session)
    except:
        return '#333'  # Default to white on error
    
def get_teammates(session):
    """Returns dict mapping team names to driver CODES"""
    teams = {}
    for driver in session.drivers:
        try:
            info = session.get_driver(driver)
            team = info['TeamName']
            driver_code = info['Abbreviation']  # Get 'VER' instead of '1'
            
            if team not in teams:
                teams[team] = []
            teams[team].append(driver_code)
        except Exception as e:
            print(f"Skipping driver {driver}: {str(e)}")
            continue
    return teams

def build_team_styles(teammates, selected_drivers):
    styles = {}
    selected_drivers = set(selected_drivers)  # For faster lookup
    
    for team, driver_codes in teammates.items():
        # Find which of this team's drivers are selected
        selected_in_team = [d for d in driver_codes if d in selected_drivers]
        
        if len(selected_in_team) >= 2:  # Only style if ≥2 teammates selected
            norm = normalize_team_name(team)
            styles[norm] = {
                selected_in_team[0]: 'dot',
                **{d: 'solid' for d in selected_in_team[1:]}
            }
    return styles #this works now lols

#////////////////APP ROUTES BELOW///////////////////////

@app.route("/")
def index():
    return render_template("index.html")

@app.route('/api/set-theme', methods=['POST'])
def set_theme():
    global plotly_template

    data = request.get_json()
    theme = data.get('theme', 'dark')

    if theme == 'dark':
        plotly_template = 'plotly_dark'
    elif theme == 'light':
        plotly_template = 'plotly_white'
    else:
        plotly_template = 'plotly_dark'

    return jsonify({'success': True, 'template': plotly_template})

@app.route("/get_drivers", methods=["POST"])
def get_drivers():
    data = request.get_json()
    race = data.get('race', 'australia')
    year = int(data.get('year', 2025))
    try:
        session = fastf1.get_session(year, race, 'R')
        session.load(telemetry=False, weather=False)

        # Step 1: get drivers grouped by team, sorted by team name, in team order
        team_to_drivers = get_teammates(session)
        sorted_teams = sorted(team_to_drivers.items(), key=lambda item: item[0].lower())
        drivers = []
        for _, team_drivers in sorted_teams:
            drivers.extend(sorted(team_drivers))  # optional: sort teammates too

        # Step 3: generate color mapping
        colors = {}
        for d in drivers:
            info = session.get_driver(d)
            team = normalize_team_name(info['TeamName'])
            colors[d] = get_driver_color(team, session)

        return jsonify({'drivers': drivers, 'driver_colors': colors})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/get_races", methods=["POST"])
def get_races():
    data = request.get_json()
    year = int(data.get('year', 2025))
    try:
        sched = fastf1.get_event_schedule(year)
        now = pd.Timestamp.now(tz='UTC')
        
        past_races = sched[
            (sched['Session5Date'] < now) &
            (~sched['EventName'].str.contains('Testing', na=False, case=False))
        ]
        past_races = past_races.sort_values('Session5Date')
        options = [
            {
                'value': ev['EventName'].lower().replace(' ', ''),
                'name': ev['EventName'],
                'date': ev['Session5Date'].strftime('%Y-%m-%d')
            }
            for _, ev in past_races.iterrows()
        ]
        return jsonify({'races': options})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route("/get_circuit_info", methods=["POST"])
def get_circuit_info():
    data = request.get_json()
    race_key = data.get('race', '').lower().replace(' ', '')
    circuit_data = CIRCUIT_DATABASE.get(race_key, None)
    
    if circuit_data:
        return jsonify(circuit_data)
    else:
        return jsonify({"error": "Circuit data not found"}), 404

# Standings endpoints removed from here

@app.route("/get_graph", methods=["POST"])
def get_graph():
    data = request.get_json()
    selected = data.get('drivers', [])
    race = data.get('race', 'australia')
    year = int(data.get('year', 2025))
    types = data.get('graph_types', ['laptimes'])
    race_key = data.get('race', '').lower().replace(' ', '')
    
    figures = {}
    weather_payload = None
    circuit_info = None

    # Handle standings separately
    if 'driver_standings' in types or 'constructor_standings' in types:
        try:
            if 'driver_standings' in types:
                fig = create_driver_standings_figure(year)
                if fig: figures['driver_standings'] = fig.to_dict()
            if 'constructor_standings' in types:
                fig = create_constructor_standings_figure(year)
                if fig: figures['constructor_standings'] = fig.to_dict()
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # Handle race-specific graphs
    race_specific_types = [t for t in types if t not in ['driver_standings', 'constructor_standings']]
    if race_specific_types:
        try:
            session = fastf1.get_session(year, race, 'R')
            session.load(telemetry=False, weather=True, messages=False, laps=True)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        
        # Weather and circuit info only for race-specific graphs
        weather_df = session.weather_data
        avg_air_temp = weather_df['AirTemp'].mean()
        avg_track_temp = weather_df['TrackTemp'].mean()
        total_rainfall_mm = weather_df['Rainfall'].sum()
        weather_payload = {
            'air_temp': round(avg_air_temp, 1),
            'track_temp': round(avg_track_temp, 1),
            'humidity': round(weather_df['Humidity'].mean(), 1) if 'Humidity' in weather_df else 'N/A',
            'rainfall': round(float(total_rainfall_mm), 2)
        }
        circuit_info = CIRCUIT_DATABASE.get(race_key, None)

        # Generate race-specific figures
        if 'laptimes' in race_specific_types:
            f = create_lap_time_figure(session, selected)
            if f: figures['laptimes'] = f.to_dict()
        if 'position' in race_specific_types:
            f = create_position_figure(session, selected)
            if f: figures['position'] = f.to_dict()
        if 'tyre' in race_specific_types:
            f = create_tyre_figure(session, selected)
            if f: figures['tyre'] = f.to_dict()
        if 'quali' in race_specific_types:
            f = create_quali_figure(session, selected)
            if f: figures['quali'] = f.to_dict()

    if not figures:
        return jsonify({"error": "No valid data found"}), 400

    return jsonify({
        'figures': figures, 
        'selected_graphs': list(figures.keys()),
        'weather': weather_payload,
        'circuit_info': circuit_info
    })

def create_driver_standings_figure(year):
    try:
        ergast = Ergast()
        standings = ergast.get_driver_standings(season=year)
        if not standings or not standings.content:
            raise ValueError("No standings data available.")
        standings_df = standings.content[0]

        drivers = standings_df['driverCode'].tolist()
        points = standings_df['points'].astype(float).tolist()
        raw_teams = standings_df['constructorNames'].tolist()
        
        # Load session for colors
        session = None
        try:
            schedule = fastf1.get_event_schedule(year)
            now = pd.Timestamp.now(tz='UTC')
            completed_races = schedule[schedule['Session5Date'] < now]
            if not completed_races.empty:
                last_race = completed_races.iloc[-1]
                session = fastf1.get_session(year, last_race['EventName'], 'R')
                session.load(laps=False, telemetry=False, messages=False, weather=False)
        except Exception:
            pass

        colors = []
        display_teams = []

        for team_list in raw_teams:
            if not isinstance(team_list, list) or not team_list:
                team_name = "Unknown"
            else:
                team_name = team_list[0]
            color = get_driver_color(team_name, session)
            colors.append(color)
            display_teams.append(normalize_team_name(team_name))

        fig = go.Figure(data=[
            go.Bar(
                x=drivers,
                y=points,
                marker=dict(color=colors),
                text=points,
                textposition="auto",
                hoverinfo='text',
                hovertext=[
                    f"Driver: {d}<br>Team: {t}<br>Points: {p}"
                    for d, t, p in zip(drivers, display_teams, points)
                ]
            )
        ])
        fig.update_layout(
            title=f"Driver Standings – {year}",
            xaxis_title="Driver Code",
            yaxis_title="Points",
            template=plotly_template,
            hovermode="closest"
        )
        return fig

    except Exception as e:
        print(f"Error: {str(e)}")
        return None

def create_constructor_standings_figure(year):
    try:
        ergast = Ergast()
        standings = ergast.get_constructor_standings(season=year)
        if not standings or not standings.content:
            return None

        standings_df = standings.content[0]
        team_names = standings_df['constructorName'].tolist()
        points = standings_df['points'].astype(float).tolist()

        # Load session for colors
        session = None
        try:
            schedule = fastf1.get_event_schedule(year)
            now = pd.Timestamp.now(tz='UTC')
            completed_races = schedule[schedule['Session5Date'] < now]
            if not completed_races.empty:
                last_race = completed_races.iloc[-1]
                session = fastf1.get_session(year, last_race['EventName'], 'R')
                session.load(laps=False, telemetry=False, messages=False, weather=False)
        except Exception:
            pass

        colors = []
        normalized_teams = []

        for name in team_names:
            norm_name = normalize_team_name(name)
            normalized_teams.append(norm_name)
            try:
                color = get_driver_color(norm_name, session) if session else '#777777'
            except Exception:
                color = '#777777'
            colors.append(color)

        fig = go.Figure(data=[
            go.Bar(
                x=normalized_teams,
                y=points,
                marker=dict(color=colors),
                text=points,
                textposition="auto"
            )
        ])
        fig.update_layout(
            title=f"Constructor Standings – {year}",
            xaxis_title="Team",
            yaxis_title="Points",
            template=plotly_template,
            hovermode="closest"
        )
        return fig

    except Exception as e:
        print(f"Error: {str(e)}")
        return None
    
def create_lap_time_figure(session, selected_drivers):
    fig = go.Figure()
    teammates = get_teammates(session)
    team_styles = build_team_styles(teammates, selected_drivers)
    has = False

    for driver in selected_drivers:
        laps = session.laps.pick_drivers(driver)
        laps = laps[laps['LapTime'].notnull()]
        if laps.empty:
            continue

        nums = laps['LapNumber'].tolist()
        secs = laps['LapTime'].dt.total_seconds().tolist()

        info = session.get_driver(driver)
        team = normalize_team_name(info['TeamName'])
        color = get_driver_color(team, session)

        # base style
        style = dict(width=2, color=color)
        # add dash/solid if defined
        if team in team_styles and driver in team_styles[team]:
            style['dash'] = team_styles[team][driver]

        fig.add_trace(go.Scatter(
            x=nums, y=secs,
            mode='lines+markers',
            name=f"{driver} ({team})",
            hovertemplate='Lap %{x}<br>Time: %{y:.3f}s',
            marker=dict(size=6, color=color),
            line=style
        ))
        has = True

    if not has:
        return None

    fig.update_layout(
        title=f"Lap Times – {session.event['EventName']} {session.event.year}",
        xaxis_title="Lap Number",
        yaxis_title="Lap Time (s)",
        template=plotly_template,
        hovermode="closest"
    )
    return fig

def create_position_figure(session, selected_drivers):
    fig = go.Figure()
    teammates = get_teammates(session)
    team_styles = build_team_styles(teammates, selected_drivers)
    has = False

    for driver in selected_drivers:
        laps = session.laps.pick_drivers(driver).dropna(subset=['Position','LapNumber'])
        if laps.empty:
            continue

        nums = laps['LapNumber'].astype(int).tolist()
        pos  = laps['Position'].astype(int).tolist()

        info = session.get_driver(driver)
        team = normalize_team_name(info['TeamName'])
        color = get_driver_color(team, session)

        style = dict(width=2, color=color)
        if team in team_styles and driver in team_styles[team]:
            style['dash'] = team_styles[team][driver]

        fig.add_trace(go.Scatter(
            x=nums, y=pos,
            mode='lines+markers',
            name=f"{driver} ({team})",
            hovertemplate='Lap %{x}<br>Position: %{y}',
            marker=dict(size=6, color=color),
            line=style
        ))
        has = True

    if not has:
        return None

    fig.update_layout(
        title=f"Race Position – {session.event['EventName']} {session.event.year}",
        xaxis_title="Lap Number",
        yaxis_title="Position",
        template=plotly_template,
        hovermode="closest",
        yaxis=dict(autorange="reversed")
    )
    return fig

def create_tyre_figure(session, selected_drivers):
    fig = go.Figure()
    has = False

    # Mapping compounds to F1 colors
    compound_colors = {
        "SOFT": "#ff2e2e",
        "MEDIUM": "#ffd12e",
        "HARD": "#f0f0f0",
        "INTERMEDIATE": "#39b54a",
        "WET": "#007aff"
    }

    for driver in selected_drivers:
        laps = session.laps.pick_drivers(driver)
        stints = laps[['LapNumber', 'Compound', 'Stint']]
        if stints.empty:
            continue

        for stint_num, data in stints.groupby('Stint'):
            start = data['LapNumber'].min()
            end = data['LapNumber'].max()
            compound = data['Compound'].iloc[0].upper()
            color = compound_colors.get(compound, "#777777")  # fallback gray

            fig.add_trace(go.Scatter(
                x=[start, end],
                y=[driver, driver],
                mode='lines',
                name=f"{driver} Stint {stint_num}",
                line=dict(width=10, color=color),
                hoverinfo='text',
                hovertext=(
                    f"Driver: {driver}<br>Stint: {stint_num}"
                    f"<br>Compound: {compound}"
                    f"<br>Laps: {start}-{end}"
                ),
                legendgroup=driver
            ))
        has = True

    if not has:
        return None

    fig.update_layout(
        title=f"Tyre Strategy – {session.event['EventName']} {session.event.year}",
        xaxis_title="Lap Number",
        yaxis_title="Driver",
        template=plotly_template,
        showlegend=False
    )
    return fig


def create_quali_figure(session, selected_drivers):
    try:
        qs = fastf1.get_session(session.event.year, session.event['EventName'], 'Q')
        qs.load()
    except Exception:
        return None

    laps = qs.laps.pick_drivers(selected_drivers).pick_quicklaps()
    if laps.empty:
        return None

    fastest = (laps.groupby("Driver")
                   .apply(lambda df: df.nsmallest(1, "LapTime"))
                   .reset_index(drop=True))
    if fastest.empty:
        return None

    fastest = fastest.sort_values("LapTime").reset_index(drop=True)
    pole = fastest.iloc[0]["LapTime"]
    fastest["Delta"] = (fastest["LapTime"] - pole).dt.total_seconds()

    fig = go.Figure()
    for _, row in fastest.iterrows():
        d = row["Driver"]
        info = qs.get_driver(d)
        team = normalize_team_name(info['TeamName'])
        color = get_driver_color(team, session)

        fig.add_trace(go.Bar(
            y=[d],
            x=[row["Delta"]],
            orientation='h',
            name=f"{d} ({team})",
            marker_color=color,
            hoverinfo='text',
            hovertext=(f"Driver: {d}<br>Team: {team}"
                       f"<br>Lap Time: {row['LapTime'].total_seconds():.3f}s"
                       f"<br>Delta to Fastest: {row['Delta']:.3f}s")
        ))

    fig.update_layout(
        title=(f"Qualifying – Delta to Fastest Selected<br>"
               f"{qs.event['EventName']} {qs.event.year}"),
        xaxis_title="Delta to Fastest (s)",
        yaxis_title="Driver",
        yaxis=dict(categoryorder='total ascending'),
        template=plotly_template,
        showlegend=False,
        margin=dict(l=100, r=40, t=80, b=40),
        height=400
    )
    return fig

if __name__ == "__main__":
    app.run(debug=True)