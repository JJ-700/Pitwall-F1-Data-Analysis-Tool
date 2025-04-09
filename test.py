from flask import Flask, render_template, request, jsonify
import fastf1
import plotly.graph_objs as go
import pandas as pd

app = Flask(__name__)
app.secret_key = "supersecretkey"

import fastf1.plotting
fastf1.plotting.setup_mpl(mpl_timedelta_support=True, color_scheme='fastf1', misc_mpl_mods=False)

drivers = ['VER', 'TSU', 'LEC', 'HAM', 'ANT', 'RUS', 'NOR', 'PIA',
           'HUL', 'BOR', 'GAS', 'DOO', 'SAI', 'ALB', 'LAW', 'HAD',
           'STR', 'ALO', 'OCO', 'BEA']

@app.route("/")
def index():
    return render_template("index.html", drivers=drivers)

@app.route("/get_graph", methods=["POST"])
def get_graph():
    data = request.get_json()
    selected_drivers = data.get('drivers', [])

    if len(selected_drivers) < 2:
        return jsonify({"error": "Please select at least 2 drivers"}), 400

    try:
        session = fastf1.get_session(2025, 'japan', 'R')
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
            
            print(f"{driver} data points: {len(lap_numbers)}")  # Debug

            fig.add_trace(go.Scatter(
                x=lap_numbers,
                y=lap_times_sec,
                mode='lines+markers',
                name=driver,
                marker=dict(size=6),
                line=dict(width=2)
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
        title="Lap Times Throughout Race",
        xaxis_title="Lap Number",
        yaxis_title="Lap Time (seconds)",
        template="plotly_dark",
        showlegend=True
    )

    # Return the figure components directly
    return jsonify({
        'data': [trace.to_plotly_json() for trace in fig.data],
        'layout': fig.layout.to_plotly_json()
    })

if __name__ == "__main__":
    app.run(debug=True)
