from flask import Flask, render_template, request, jsonify
import fastf1
import plotly.graph_objs as go
import pandas as pd

app = Flask(__name__)
app.secret_key = "supersecretkey"

import fastf1.plotting
fastf1.plotting.setup_mpl(mpl_timedelta_support=True, color_scheme='fastf1', misc_mpl_mods=False)

@app.route("/")
def index():
    return render_template("index.html")

def get_driver_team_color(year, driver_code):
    try:
        # Get the team color for a driver in a specific year
        event = fastf1.get_event(year, 1)  # Get first event of the year
        session = fastf1.get_session(year, event['EventName'], 'R')
        session.load(telemetry=False, weather=False, messages=False)
        
        driver_info = session.get_driver(driver_code)
        team_name = driver_info['TeamName']
        
        # Get team color from FastF1
        team_color = fastf1.plotting.team_color(team_name)
        return team_color
    
    except Exception as e:
        print(f"Error getting team color for {driver_code} in {year}: {str(e)}")
        return '#ffffff'  # Default white if error occurs

@app.route("/get_drivers", methods=["POST"])
def get_drivers():
    data = request.get_json()
    selected_country = data.get('country', 'australia')
    selected_year = data.get('year', 2025)

    try:
        session = fastf1.get_session(int(selected_year), selected_country, 'R')
        session.load(telemetry=False, weather=False, messages=False)
        
        # Get unique drivers from the session
        drivers_in_session = session.laps['Driver'].unique().tolist()
        
        # Get team colors for each driver in this session
        session_driver_colors = {}
        for driver in drivers_in_session:
            try:
                driver_info = session.get_driver(driver)
                team_name = driver_info['TeamName']
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

@app.route("/get_graph", methods=["POST"])
def get_graph():
    data = request.get_json()
    selected_drivers = data.get('drivers', [])
    selected_country = data.get('country', 'australia')
    selected_year = data.get('year', 2025)

    try:
        session = fastf1.get_session(int(selected_year), selected_country, 'R')
        session.load()
        print(f"Session loaded with {len(session.laps)} laps")  # Debug
    except Exception as e:
        print(f"Error loading session: {str(e)}")  # Debug
        return jsonify({"error": f"Failed to load session data: {str(e)}"}), 500

    fig = go.Figure()
    has_data = False

    for driver in selected_drivers:
        try:
            driver_laps = session.laps.pick_drivers(driver)
            valid_laps = driver_laps[driver_laps['LapTime'].notnull()]
            
            if len(valid_laps) == 0:
                print(f"No valid laps for {driver}")  # Debug
                continue

            lap_numbers = valid_laps['LapNumber'].tolist()
            lap_times_sec = valid_laps['LapTime'].dt.total_seconds().tolist()
            
            # Get the driver's team color for this session
            try:
                driver_info = session.get_driver(driver)
                team_name = driver_info['TeamName']
                color = fastf1.plotting.team_color(team_name)
            except Exception as e:
                print(f"Error getting team color for {driver}: {str(e)}")
                color = '#ffffff'  # Default white
            
            fig.add_trace(go.Scatter(
                x=lap_numbers,
                y=lap_times_sec,
                mode='lines+markers',
                name=f"{driver} ({team_name})",  # Include team name in legend
                hovertemplate='Lap %{x}<br>Time: %{y:.3f}s',
                marker=dict(size=6, color=color),
                line=dict(width=2, color=color)
            ))
            has_data = True

        except Exception as e:
            print(f"Error processing {driver}: {str(e)}")  # Debug
            continue

    if not has_data:
        error_msg = "No valid lap data found for selected drivers"
        print(error_msg)  # Debug
        return jsonify({"error": error_msg}), 400

    fig.update_layout(
        title=f"Lap Times Throughout Race - {session.event['EventName']} {selected_year}",
        xaxis_title="Lap Number",
        yaxis_title="Lap Time (seconds)",
        template="plotly_dark",
        hovermode="closest",
        showlegend=True
    )

    return jsonify({
        'data': [trace.to_plotly_json() for trace in fig.data],
        'layout': fig.layout.to_plotly_json()
    })

if __name__ == "__main__":
    app.run(debug=True)