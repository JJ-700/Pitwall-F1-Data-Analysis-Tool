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

# New: Mapping of drivers to their team colours
driver_colors = {
    'VER': '#3671c6',   # 
    'TSU': '#285393',   # 
    'LEC': '#e8002d',   # 
    'HAM': '#b40023',   # 
    'ANT': '#27f4d2',   # 
    'RUS': '#1ec1a6',   # 
    'NOR': '#ff8000',   # 
    'PIA': '#cc6600',   # 
    'HUL': '#52e252',   # 
    'BOR': '#3faf3f',   # 
    'GAS': '#e66cbb',   # 
    'DOO': '#b35491',   # 
    'SAI': '#1868db',   # 
    'ALB': '#1868db',   # 
    'LAW': '#6692ff',   # 
    'HAD': '#5174cc',   # 
    'STR': '#16654b',   #
    'ALO': '#229971',   # 
    'OCO': '#84878a',   # 
    'BEA': '#b6babd'    # 
}

@app.route("/")
def index():
    # Pass driver_colors to template so that each driver button can include its team colour
    return render_template("index.html", drivers=drivers, driver_colors=driver_colors)

@app.route("/get_graph", methods=["POST"])
def get_graph():
    data = request.get_json()
    selected_drivers = data.get('drivers', [])

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
            
            # Use the team colour for the driver in both marker and line
            color = driver_colors.get(driver, '#ffffff')
            
            fig.add_trace(go.Scatter(
                x=lap_numbers,
                y=lap_times_sec,
                mode='lines+markers',
                name=driver,
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
        title="Lap Times Throughout Race",
        xaxis_title="Lap Number",
        yaxis_title="Lap Time (seconds)",
        template="plotly_dark",
        hovermode="closest",
        showlegend=True
    )

    # Return the figure components directly
    return jsonify({
        'data': [trace.to_plotly_json() for trace in fig.data],
        'layout': fig.layout.to_plotly_json()
    })

if __name__ == "__main__":
    app.run(debug=True)
