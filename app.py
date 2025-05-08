import fastf1.api
from flask import Flask, render_template, request, jsonify
import fastf1
import plotly.graph_objs as go
import pandas as pd

app = Flask(__name__)
app.secret_key = "supersecretkey"
plotly_template = 'plotly_dark'  # Default template

import fastf1.plotting
fastf1.plotting.setup_mpl(
    mpl_timedelta_support=True,
    color_scheme='fastf1',
    misc_mpl_mods=False
)

# Caching location is autoselected based on the OS and is autoscanned by FastF1 when retreiving data.

# Hardcoded dataset for static information, for faster loading
CIRCUIT_DATABASE = {
    "bahraingrandprix": {
        "location": "Sakhir, Bahrain",
        "length_km": 5.412,
        "turns": 15,
        "lap_record": "1:31.447 (Pedro de la Rosa, 2005)"
    },
    "saudiarabiangrandprix": {
        "location": "Jeddah, Saudi Arabia",
        "length_km": 6.174,
        "turns": 27,
        "lap_record": "1:28.049 (Lewis Hamilton, 2021)"
    },
    "australiangrandprix": {
        "location": "Melbourne, Australia",
        "length_km": 5.278,
        "turns": 14,
        "lap_record": "1:20.260 (Charles Leclerc, 2022)"
    },
    "japanesegrandprix": {
        "location": "Suzuka, Japan",
        "length_km": 5.807,
        "turns": 18,
        "lap_record": "1:30.983 (Lewis Hamilton, 2019)"
    },
    "chinesegrandprix": {
        "location": "Shanghai, China",
        "length_km": 5.451,
        "turns": 16,
        "lap_record": "1:32.238 (Michael Schumacher, 2004)"
    },
    "miamigrandprix": {
        "location": "Miami, USA",
        "length_km": 5.412,
        "turns": 19,
        "lap_record": "1:29.708 (Max Verstappen, 2023)"
    },
    "emiliaromagnagrandprix": {
        "location": "Imola, Italy",
        "length_km": 4.909,
        "turns": 19,
        "lap_record": "1:15.484 (Lewis Hamilton, 2020)"
    },
    "monacograndprix": {
        "location": "Monte Carlo, Monaco",
        "length_km": 3.337,
        "turns": 19,
        "lap_record": "1:12.909 (Lewis Hamilton, 2021)"
    },
    "canadiangrandprix": {
        "location": "Montreal, Canada",
        "length_km": 4.361,
        "turns": 14,
        "lap_record": "1:13.078 (Valtteri Bottas, 2019)"
    },
    "spanishgrandprix": {
        "location": "Montmeló, Spain",
        "length_km": 4.675,
        "turns": 16,
        "lap_record": "1:16.330 (Max Verstappen, 2023)"
    },
    "austriangrandprix": {
        "location": "Spielberg, Austria",
        "length_km": 4.318,
        "turns": 10,
        "lap_record": "1:05.619 (Carlos Sainz, 2020)"
    },
    "britishgrandprix": {
        "location": "Silverstone, UK",
        "length_km": 5.891,
        "turns": 18,
        "lap_record": "1:27.097 (Max Verstappen, 2020)"
    },
    "hungariangrandprix": {
        "location": "Mogyoród, Hungary",
        "length_km": 4.381,
        "turns": 14,
        "lap_record": "1:16.627 (Lewis Hamilton, 2020)"
    },
    "belgiangrandprix": {
        "location": "Stavelot, Belgium",
        "length_km": 7.004,
        "turns": 19,
        "lap_record": "1:46.286 (Valtteri Bottas, 2018)"
    },
    "dutchgrandprix": {
        "location": "Zandvoort, Netherlands",
        "length_km": 4.259,
        "turns": 14,
        "lap_record": "1:11.097 (Lewis Hamilton, 2021)"
    },
    "italiangrandprix": {
        "location": "Monza, Italy",
        "length_km": 5.793,
        "turns": 11,
        "lap_record": "1:21.046 (Rubens Barrichello, 2004)"
    },
    "azerbaijangrandprix": {
        "location": "Baku, Azerbaijan",
        "length_km": 6.003,
        "turns": 20,
        "lap_record": "1:43.009 (Charles Leclerc, 2019)"
    },
    "singaporegrandprix": {
        "location": "Singapore",
        "length_km": 5.063,
        "turns": 23,
        "lap_record": "1:35.867 (Lewis Hamilton, 2023)"
    },
    "unitedstatesgrandprix": {
        "location": "Austin, USA",
        "length_km": 5.513,
        "turns": 20,
        "lap_record": "1:36.169 (Charles Leclerc, 2019)"
    },
    "mexicocitygrandprix": {
        "location": "Mexico City, Mexico",
        "length_km": 4.304,
        "turns": 17,
        "lap_record": "1:17.774 (Valtteri Bottas, 2021)"
    },
    "sãopaulograndprix": {
        "location": "São Paulo, Brazil",
        "length_km": 4.309,
        "turns": 15,
        "lap_record": "1:10.540 (Lewis Hamilton, 2018)"
    },
    "lasvegasgrandprix": {
        "location": "Las Vegas, USA",
        "length_km": 6.120,
        "turns": 17,
        "lap_record": "1:35.490 (Oscar Piastri, 2023)"
    },
    "qatargrandprix": {
        "location": "Lusail, Qatar",
        "length_km": 5.380,
        "turns": 16,
        "lap_record": "1:23.196 (Max Verstappen, 2023)"
    },
    "abudhabigrandprix": {
        "location": "Abu Dhabi, UAE",
        "length_km": 5.281,
        "turns": 16,
        "lap_record": "1:26.103 (Max Verstappen, 2021)"
    }
}

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

def get_driver_color(team_name):
    """Get a safe team colour, defaulting to white on error, with special case for HAAS."""
    try:
        if team_name == 'haas':
            return '#d3d3d3'  # Light grey for HAAS
        return fastf1.plotting.team_color(team_name)
    except:
        return '#ffffff'  # Default to white on error

def build_team_styles(teammates, selected_drivers):
    """
    Returns a dict of dicts:
      { normalized_team_name: { driver1: 'dash', driver2: 'solid', … } }
    Only for teams where ≥2 selected_drivers exist.
    """
    styles = {}
    for team, drivers in teammates.items():
        # filter & normalize
        drivers = [d for d in drivers if d in selected_drivers]
        if len(drivers) > 1:
            norm = normalize_team_name(team)
            styles[norm] = {}
            # first gets dash, rest solid
            styles[norm][drivers[0]] = 'dash'
            for d in drivers[1:]:
                styles[norm][d] = 'solid'
    return styles

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
    
    print(f"Plotly template set to: {plotly_template}")  # For debugging/logging

    return jsonify({'success': True, 'template': plotly_template})


@app.route("/get_drivers", methods=["POST"])
def get_drivers():
    data = request.get_json()
    race = data.get('race', 'australia')
    year = int(data.get('year', 2025))
    try:
        session = fastf1.get_session(year, race, 'R')
        session.load(telemetry=False, weather=False, messages=False)
        drivers = session.laps['Driver'].unique().tolist()
        colors = {}
        for d in drivers:
            info = session.get_driver(d)
            team = normalize_team_name(info['TeamName'])
            colors[d] = get_driver_color(team)
        return jsonify({'drivers': drivers, 'driver_colors': colors})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/get_races", methods=["POST"])
def get_races():
    data = request.get_json()
    year = int(data.get('year', 2025))
    try:
        sched = fastf1.get_event_schedule(year)
        past = sched[
            (sched['EventDate'] < pd.Timestamp.now()) &
            (~sched['EventName'].str.contains('Testing', na=False, case=False))
        ]
        options = [
            {'value': ev['EventName'].lower().replace(' ', ''), 'name': ev['EventName']}
            for _, ev in past.iterrows()
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

@app.route("/get_graph", methods=["POST"])
def get_graph():
    data = request.get_json()
    selected = data.get('drivers', [])
    race = data.get('race', 'australia')
    year = int(data.get('year', 2025))
    types = data.get('graph_types', ['laptimes'])
    race_key = data.get('race', '').lower().replace(' ', '')
    try:
        session = fastf1.get_session(year, race, 'R')
        session.load()
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    # Access weather data
    weather_df = session.weather_data

    # Calculate average air and track temperatures
    avg_air_temp = weather_df['AirTemp'].mean()
    avg_track_temp = weather_df['TrackTemp'].mean()

    # Determine if there was any rainfall
    total_rainfall_mm = weather_df['Rainfall'].sum()

    # Create a weather payload
    weather_payload = {
    'air_temp': round(avg_air_temp, 1),
    'track_temp': round(avg_track_temp, 1),
    'humidity': round(weather_df['Humidity'].mean(), 1) if 'Humidity' in weather_df else 'N/A',
    'rainfall': round(float(total_rainfall_mm), 2)
    }
    # Get circuit information from the hardcoded dataset
    circuit_info = CIRCUIT_DATABASE.get(race_key, None)

    figures = {}
    if 'laptimes' in types:
        f = create_lap_time_figure(session, selected)
        if f: figures['laptimes'] = f.to_dict()
    if 'position' in types:
        f = create_position_figure(session, selected)
        if f: figures['position'] = f.to_dict()
    if 'tyre' in types:
        f = create_tyre_figure(session, selected)
        if f: figures['tyre'] = f.to_dict()
    if 'quali' in types:
        f = create_quali_figure(session, selected)
        if f: figures['quali'] = f.to_dict()

    if not figures:
        return jsonify({"error": "No valid data found"}), 400

    return jsonify({'figures': figures, 'selected_graphs': list(figures.keys()), 'weather': weather_payload, 'circuit_info': circuit_info})

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
        color = get_driver_color(team)

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
        color = get_driver_color(team)

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
    teammates = get_teammates(session)
    team_styles = build_team_styles(teammates, selected_drivers)
    has = False

    for driver in selected_drivers:
        laps = session.laps.pick_drivers(driver)
        stints = laps[['LapNumber','Compound','Stint']]
        if stints.empty:
            continue

        info = session.get_driver(driver)
        team = normalize_team_name(info['TeamName'])
        color = get_driver_color(team)

        for stint_num, data in stints.groupby('Stint'):
            start = data['LapNumber'].min()
            end   = data['LapNumber'].max()
            dash  = team_styles.get(team, {}).get(driver, None)

            fig.add_trace(go.Scatter(
                x=[start, end], y=[driver, driver],
                mode='lines',
                name=f"{driver} Stint {stint_num}",
                line=dict(width=10, color=color, dash=dash) if dash else dict(width=10, color=color),
                hoverinfo='text',
                hovertext=(f"Driver: {driver}<br>Stint: {stint_num}"
                           f"<br>Compound: {data['Compound'].iloc[0]}"
                           f"<br>Laps: {start}-{end}"),
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
        color = get_driver_color(team)

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