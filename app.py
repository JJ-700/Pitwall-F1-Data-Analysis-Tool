from flask import Flask, render_template, request, jsonify
import fastf1
import plotly.graph_objs as go
import plotly.io as pio
import pandas as pd

app = Flask(__name__)
app.secret_key = "supersecretkey"

import fastf1.plotting
fastf1.plotting.setup_mpl(mpl_timedelta_support=True, color_scheme='fastf1', misc_mpl_mods=False)

#/////////////HELPER FUNCTIONS BELOW////////////////////

#////////////////APP ROUTES BELOW///////////////////////

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/get_drivers", methods=["POST"])
def get_drivers():
    data = request.get_json()
    selected_race = data.get('race', 'japan')
    selected_year = data.get('year', 2025)

    try:
        session = fastf1.get_session(int(selected_year), selected_race, 'R')
        session.load(telemetry=False, weather=False, messages=False)
        
        # Get unique drivers from the session
        drivers_in_session = session.laps['Driver'].unique().tolist()
        
        # Get team colors for each driver in this session
        session_driver_colors = {}
        for driver in drivers_in_session:
            try:
                driver_info = session.get_driver(driver)
                team_name = driver_info['TeamName']
                if team_name == "Racing Bulls":
                    team_color = '#1634cb'
                else:
                    team_color = fastf1.plotting.team_color(team_name)
                session_driver_colors[driver] = team_color
            except Exception as e:
                print(f"Error getting color for {driver}: {str(e)}")
                session_driver_colors[driver] = '#ffffff'  # Default white
        
        return jsonify({
            'drivers': drivers_in_session,
            'driver_colors': session_driver_colors
        })
        
    except Exception as e:
        return jsonify({"error": f"Failed to load session data: {str(e)}"}), 500
    
@app.route("/get_races", methods=["POST"])
def get_races():
    data = request.get_json()
    selected_year = data.get('year', 2025)
    
    try:
        schedule = fastf1.get_event_schedule(int(selected_year))
        # Get only races that happened (ignore cancelled/postponed)
        races = schedule[
            (schedule['EventDate'] < pd.Timestamp.now()) &
            (~schedule['EventName'].str.contains('Testing', case=False, na=False))
        ]

        race_options = []
        for _, event in races.iterrows():
            race_options.append({
                'value': event['EventName'].lower().replace(' ', ''),
                'name': event['EventName']
            })
        
        return jsonify({'races': race_options})
        
    except Exception as e:
        return jsonify({"error": f"Failed to load races: {str(e)}"}), 500

@app.route("/get_graph", methods=["POST"])
def get_graph():
    data = request.get_json()
    selected_drivers = data.get('drivers', [])
    selected_race = data.get('race', 'australia')
    selected_year = data.get('year', 2025)
    graph_types = data.get('graph_types', ['laptimes'])

    try:
        session = fastf1.get_session(int(selected_year), selected_race, 'R')
        session.load()

    except Exception as e:
        return jsonify({"error": f"Failed to load session data: {str(e)}"}), 500

    figures = {}
    
    if 'laptimes' in graph_types:
        fig = create_lap_time_figure(session, selected_drivers)
        if fig:
            figures['laptimes'] = fig.to_dict()  # Convert directly to dict
    
    if 'position' in graph_types:
        fig = create_position_figure(session, selected_drivers)
        if fig:
            figures['position'] = fig.to_dict()  # Convert directly to dict
    
    if 'tyre' in graph_types:
        fig = create_tyre_figure(session, selected_drivers)
        if fig:
            figures['tyre'] = fig.to_dict()  # Convert directly to dict
    
    if 'quali' in graph_types:
        fig = create_quali_figure(session, selected_drivers)
        if fig:
            figures['quali'] = fig.to_dict()  # Convert directly to dict

    if not figures:
        return jsonify({"error": "No valid data found for selected graph types"}), 400

    return jsonify({
        'figures': figures,  # Already converted to dict
        'selected_graphs': list(figures.keys())
    })


def create_lap_time_figure(session, selected_drivers):
    fig = go.Figure()
    has_data = False

    for driver in selected_drivers:
        try:
            driver_laps = session.laps.pick_drivers(driver)
            valid_laps = driver_laps[driver_laps['LapTime'].notnull()]
            
            if len(valid_laps) == 0:
                continue

            lap_numbers = valid_laps['LapNumber'].tolist()
            lap_times_sec = valid_laps['LapTime'].dt.total_seconds().tolist()
            
            try:
                driver_info = session.get_driver(driver)
                team_name = driver_info['TeamName']
                if team_name == "Racing Bulls":
                    team_name = "RB"
                color = fastf1.plotting.team_color(team_name)
            except Exception:
                color = '#ffffff'
            
            fig.add_trace(go.Scatter(
                x=lap_numbers,
                y=lap_times_sec,
                mode='lines+markers',
                name=f"{driver} ({team_name})",
                hovertemplate='Lap %{x}<br>Time: %{y:.3f}s',
                marker=dict(size=6, color=color),
                line=dict(width=2, color=color)
            ))
            has_data = True
        except Exception:
            continue

    if not has_data:
        return None

    fig.update_layout(
        title=f"Lap Times - {session.event['EventName']} {session.event.year}",
        xaxis_title="Lap Number",
        yaxis_title="Lap Time (seconds)",
        template="plotly_dark",
        hovermode="closest"
    )
    return fig

def create_position_figure(session, selected_drivers):
    fig = go.Figure()
    has_data = False

    for driver in selected_drivers:
        try:
            # pick only this driver's laps
            driver_laps = session.laps.pick_drivers(driver)

            # drop any rows where Position or LapNumber is missing
            driver_laps = driver_laps.dropna(subset=['Position', 'LapNumber'])
            if driver_laps.empty:
                continue

            # cast to ints so we don’t get floats or NaN in the JSON
            lap_numbers = driver_laps['LapNumber'].astype(int).tolist()
            positions   = driver_laps['Position'].astype(int).tolist()

            # get a safe color for the team
            try:
                driver_info = session.get_driver(driver)
                team_name = driver_info['TeamName']
                if team_name == "Racing Bulls":
                    team_name = "RB"
                color = fastf1.plotting.team_color(team_name)
            except Exception:
                color = '#ffffff'

            # add the trace
            fig.add_trace(go.Scatter(
                x=lap_numbers,
                y=positions,
                mode='lines+markers',
                name=f"{driver} ({team_name})",
                hovertemplate='Lap %{x}<br>Position: %{y}',
                marker=dict(size=6, color=color),
                line=dict(width=2, color=color)
            ))
            has_data = True

        except Exception:
            # if anything goes wrong for this driver, skip them
            continue

    if not has_data:
        return None

    fig.update_layout(
        title=f"Race Position - {session.event['EventName']} {session.event.year}",
        xaxis_title="Lap Number",
        yaxis_title="Position",
        template="plotly_dark",
        hovermode="closest",
        yaxis=dict(autorange="reversed"),
    )
    return fig

def create_tyre_figure(session, selected_drivers):
    fig = go.Figure()
    has_data = False

    for driver in selected_drivers:
        try:
            driver_laps = session.laps.pick_drivers(driver)
            stints = driver_laps[['LapNumber', 'Compound', 'Stint']]
            
            if len(stints) == 0:
                continue

            try:
                driver_info = session.get_driver(driver)
                team_name = driver_info['TeamName']
                if team_name == "Racing Bulls":
                    team_name = "RB"
                color = fastf1.plotting.team_color(team_name)
            except Exception:
                color = '#ffffff'
            
            for stint_num, stint_data in stints.groupby('Stint'):
                compound = stint_data['Compound'].iloc[0]
                start_lap = stint_data['LapNumber'].min()
                end_lap = stint_data['LapNumber'].max()
                
                fig.add_trace(go.Scatter(
                    x=[start_lap, end_lap],
                    y=[driver, driver],
                    mode='lines',
                    name=f"{driver} Stint {stint_num}",
                    line=dict(width=10, color=color),
                    hoverinfo='text',
                    hovertext=f"Driver: {driver}<br>Stint: {stint_num}<br>Compound: {compound}<br>Laps: {start_lap}-{end_lap}",
                    legendgroup=driver
                ))
            
            has_data = True
        except Exception:
            continue

    if not has_data:
        return None

    fig.update_layout(
        title=f"Tyre Strategy - {session.event['EventName']} {session.event.year}",
        xaxis_title="Lap Number",
        yaxis_title="Driver",
        template="plotly_dark",
        showlegend=False
    )
    return fig

def create_quali_figure(session, selected_drivers):

    try:
        quali_session = fastf1.get_session(session.event.year, session.event['EventName'], 'Q')
        quali_session.load()
    except Exception as e:
        print(f"Failed to load qualifying session: {e}")
        return None

    # Filter and group
    laps = quali_session.laps.pick_drivers(selected_drivers).pick_quicklaps()
    if laps.empty:
        print("No laps found for selected drivers.")
        return None

    fastest_laps = laps.groupby("Driver").apply(lambda df: df.nsmallest(1, "LapTime")).reset_index(drop=True)
    if fastest_laps.empty:
        print("No fastest laps found.")
        return None

    fastest_laps = fastest_laps.sort_values(by="LapTime").reset_index(drop=True)

    # Delta to pole
    pole_time = fastest_laps.iloc[0]["LapTime"]
    fastest_laps["DeltaToPole"] = fastest_laps["LapTime"] - pole_time
    fastest_laps["DeltaToPoleSeconds"] = fastest_laps["DeltaToPole"].dt.total_seconds()
    fastest_laps["LapTimeSeconds"] = fastest_laps["LapTime"].dt.total_seconds()

    fig = go.Figure()

    for _, row in fastest_laps.iterrows():
        driver = row["Driver"]
        lap_time = row["LapTimeSeconds"]
        delta = row["DeltaToPoleSeconds"]
        position = row["Position"]

        try:
            driver_info = quali_session.get_driver(driver)
            team_name = driver_info['TeamName']
            if team_name == "Racing Bulls":
                team_name = "RB"
            color = fastf1.plotting.team_color(team_name)
        except Exception:
            team_name = "Unknown"
            color = "#CCCCCC"

        fig.add_trace(go.Bar(
            y=[driver],
            x=[delta],
            orientation='h',
            name=f"{driver} ({team_name})",
            marker_color=color,
            hoverinfo='text',
            hovertext=(
                f"Driver: {driver}<br>"
                f"Team: {team_name}<br>"
                f"Position: {position}<br>"
                f"Lap Time: {lap_time:.3f}s<br>"
                f"Delta to Pole: {delta:.3f}s"
            )
        ))

    fig.update_layout(
        title=f"Qualifying - Delta to Fastest Selected <br>{quali_session.event['EventName']} {quali_session.event.year}",
        xaxis_title="Delta to Fastest (s)",
        yaxis_title="Driver",
        yaxis=dict(
            categoryorder='total ascending'  # pole sitter at top
        ),
        template="plotly_dark",
        showlegend=False,
        margin=dict(l=100, r=40, t=80, b=40),
        height=400  # consistent with other graphs
    )

    return fig

if __name__ == "__main__":
    app.run(debug=True)