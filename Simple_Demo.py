import fastf1
from fastf1 import plotting
from matplotlib import pyplot as plt

# Setup
plotting.setup_mpl(mpl_timedelta_support=True, misc_mpl_mods=False, color_scheme='fastf1')
session = fastf1.get_session(2025, 'Japan', 'R')
session.load()

available_drivers = session.laps['Driver'].unique().tolist()
print(f"\nAvailable drivers: {', '.join(available_drivers)}")

# --- DRIVER INPUT ---
while True:
    user_input = input("\nEnter 2–20 driver codes (comma-separated, e.g. VER,LEC,HAM): ").upper()
    user_drivers = [d.strip() for d in user_input.split(",")]
    if not (2 <= len(user_drivers) <= 20):
        print("❌ Please enter between 2 and 20 drivers.")
        continue
    invalid = [d for d in user_drivers if d not in available_drivers]
    if invalid:
        print(f"❌ Invalid drivers: {', '.join(invalid)}. Try again.")
        continue
    break

# --- METRIC INPUT ---
metrics_map = {
    "1": "LapTime",
    "2": "SpeedST",
    "3": "TrackStatus"
}
print("\nAvailable metrics:\n1 = LapTime \n2 = Speed Trap\n3 = Track Status")

while True:
    metric_input = input("Enter metrics to compare (comma-separated, e.g. 1,2): ")
    selected_metrics = [m.strip() for m in metric_input.split(",") if m.strip() in metrics_map]
    if not selected_metrics:
        print("❌ Invalid selection. Try again.")
        continue
    break

fig, ax_main = plt.subplots(figsize=(12, 6))
axes = [ax_main]

styles = [
    {'color': 'auto', 'linestyle': 'solid', 'linewidth': 2, 'alpha': 0.8},
    {'color': 'auto', 'linestyle': 'dashed', 'linewidth': 2, 'alpha': 0.8}
]

# Map metric to axis index (main axis first, others on twin axes)
metric_axes = {}

for i, metric_key in enumerate(selected_metrics):
    metric_name = metrics_map[metric_key]
    if i == 0:
        metric_axes[metric_name] = ax_main
    else:
        ax = ax_main.twinx()
        ax.spines["right"].set_position(("axes", 1 + 0.1 * (i - 1)))  # Offset twin axes
        axes.append(ax)
        metric_axes[metric_name] = ax

# Plot each metric for each driver
for idx, driver in enumerate(user_drivers):
    laps = session.laps.pick_drivers(driver).pick_quicklaps().reset_index()
    if laps.empty:
        print(f"⚠️ No quick laps for {driver}. Skipping.")
        continue

    style = plotting.get_driver_style(driver, style=styles, session=session)

    for metric_key in selected_metrics:
        metric_name = metrics_map[metric_key]
        ax = metric_axes[metric_name]
        label = f"{driver} - {metric_name}"

        if metric_name == "LapTime":
            ax.plot(laps['LapNumber'], laps['LapTime'], label=label, **style)

        elif metric_name == "SpeedST":
            ax.plot(laps['LapNumber'], laps['SpeedST'], label=label, linestyle='dashdot')

        elif metric_name == "TrackStatus":
            ax.plot(laps['LapNumber'], laps['TrackStatus'].fillna(0), label=label, linestyle='dashed')

# Axis labels and legend
axes[0].set_xlabel("Lap Number")
for metric, ax in metric_axes.items():
    ax.set_ylabel(metric)

# Combine all legends
lines_labels = [ax.get_legend_handles_labels() for ax in axes]
lines, labels = zip(*lines_labels)
flat_lines = sum(lines, [])
flat_labels = sum(labels, [])
axes[0].legend(flat_lines, flat_labels, loc='upper center', bbox_to_anchor=(0.5, 1.15), ncol=3)

axes[0].set_title("Dynamic Multi-Metric Driver Comparison")
plt.tight_layout()
plt.show()
