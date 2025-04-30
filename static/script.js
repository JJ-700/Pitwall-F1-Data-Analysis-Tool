const selectedDrivers = new Set();
const selectedGraphTypes = new Set(['laptimes']);

// Function to create driver buttons
function createDriverButtons(drivers, driverColors) {
    const container = document.getElementById('driver-buttons-container');
    container.innerHTML = '';
        
    drivers.forEach(driver => {
        const btn = document.createElement('button');
        btn.className = 'driver-btn';
        btn.dataset.driver = driver;
        btn.dataset.color = driverColors[driver] || '#333';
        btn.textContent = driver;
        btn.style.backgroundColor = '#333';
        
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            if (btn.classList.contains('active')) {
                const bgColor = btn.dataset.color;
                btn.style.backgroundColor = bgColor;

                // Set text color based on background — for Haas (#FFFFFF or close to white)
                if (bgColor.toLowerCase() === '#ffffff' || bgColor.toLowerCase() === '#fff') {
                    btn.style.color = 'black';
                } else {
                    btn.style.color = 'white';
                }

                selectedDrivers.add(btn.dataset.driver);
            } else {
                btn.style.backgroundColor = '#333';
                btn.style.color = 'white';
                selectedDrivers.delete(btn.dataset.driver);
            }
        });
        container.appendChild(btn);
    });
}

// Helper functions
function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function clearError() {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = "";
    errorDiv.style.display = 'none';
}

function getGraphTitle(graphType) {
    const titles = {
        'laptimes': 'Lap Times Comparison',
        'position': 'Race Position Changes',
        'tyre': 'Tyre Stint Strategy',
        'quali': 'Qualifying Results'
    };
    return titles[graphType] || graphType;
}

function showProgressBar() {
    const container = document.getElementById('progress-bar-container');
    const bar = document.getElementById('progress-bar');
    container.style.display = 'block';
    bar.style.width = '5%'; // start it small
}

function updateProgressBar(percent) {
    const bar = document.getElementById('progress-bar');
    bar.style.width = percent + '%';
}

function completeProgressBar() {
    updateProgressBar(100);
    setTimeout(() => {
        document.getElementById('progress-bar-container').style.display = 'none';
        document.getElementById('progress-bar').style.width = '0%';
    }, 800); // allow it to reach 100% visibly
}

function resetProgressBar() {
    const bar = document.getElementById('progress-bar');
    bar.style.width = '0%';
    document.getElementById('progress-bar-container').style.display = 'none';
}


// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    const yearDropdown = document.getElementById('year');
    const raceDropdown = document.getElementById('race');
    document.getElementById('instructional-modal').style.display = 'block';      

    function loadRacesForYear(year) {
        raceDropdown.innerHTML = '<option value="">Loading races...</option>';
        
        fetch('/get_races', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year: year })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                raceDropdown.innerHTML = '<option value="">Error loading races</option>';
                showError(data.error);
                return;
            }

            raceDropdown.innerHTML = '';
            data.races.forEach(race => {
                const option = document.createElement('option');
                option.value = race.value;
                option.textContent = race.name;
                raceDropdown.appendChild(option);
            });

            if (data.races.length > 0) {
                raceDropdown.value = data.races[0].value;
                loadDrivers();
            }
        })
        .catch(error => {
            raceDropdown.innerHTML = '<option value="">Error loading races</option>';
            showError('Failed to load races: ' + error.message);
        });

        // Close the modal when the 'Got it!' button is clicked
        document.getElementById('got-it-btn').onclick = function() {
            document.getElementById('instructional-modal').style.display = 'none';
        }
    }

    function loadDrivers() {
        const selectedRace = document.getElementById('race').value;
        const selectedYear = document.getElementById('year').value;
        const driverContainer = document.getElementById('driver-buttons-container');
        
        driverContainer.innerHTML = '<div class="loading-text-drivers">Loading drivers...</div>';
        document.getElementById('plot').innerHTML = '';
        document.getElementById('graph-controls').style.display = 'none';
        document.getElementById('weather-info').style.display = 'none';
        selectedDrivers.clear();
        
        fetch('/get_drivers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ race: selectedRace, year: selectedYear })
        })
        .then(response => response.json())
        .then(data => {
            driverContainer.innerHTML = '';
            if (data.error) {
                showError(data.error);
            } else {
                createDriverButtons(data.drivers, data.driver_colors);
            }
        })
        .catch(error => {
            driverContainer.innerHTML = '';
            showError('Failed to load drivers: ' + error.message);
        });
    }

    yearDropdown.addEventListener('change', () => {
        loadRacesForYear(yearDropdown.value);
    });

    raceDropdown.addEventListener('change', () => {
        document.getElementById('weather-info').style.display = 'none';
        loadDrivers();
    });

    document.getElementById('generate-btn').addEventListener('click', () => {
        const selectedRace = document.getElementById('race').value;
        const selectedYear = document.getElementById('year').value;
        const selectedDrivers = document.querySelectorAll(".driver-btn.active");
        const raceName = document.getElementById('race').options[document.getElementById('race').selectedIndex].text;

        if (selectedDrivers.length === 0) {
            alert("Please select at least one driver before generating the graph.");
            return;
        }

        showProgressBar();              // 🔴 Start progress bar
        updateProgressBar(10);          // 🔴 Initial progress

        const raceToCountry = {
            'Bahrain Grand Prix': 'bahrain',
            'Saudi Arabian Grand Prix': 'saudi-arabia',
            'Australian Grand Prix': 'australia',
            'Japanese Grand Prix': 'japan',
            'Chinese Grand Prix': 'china',
            'Miami Grand Prix': 'united-states',
            'Emilia Romagna Grand Prix': 'italy',
            'Monaco Grand Prix': 'monaco',
            'Canadian Grand Prix': 'canada',
            'Spanish Grand Prix': 'spain',
            'Austrian Grand Prix': 'austria',
            'British Grand Prix': 'united-kingdom',
            'Hungarian Grand Prix': 'hungary',
            'Belgian Grand Prix': 'belgium',
            'Dutch Grand Prix': 'netherlands',
            'Italian Grand Prix': 'italy',
            'Azerbaijan Grand Prix': 'azerbaijan',
            'Singapore Grand Prix': 'singapore',
            'United States Grand Prix': 'united-states',
            'Mexico City Grand Prix': 'mexico',
            'São Paulo Grand Prix': 'brazil',
            'Las Vegas Grand Prix': 'united-states',
            'Qatar Grand Prix': 'qatar',
            'Abu Dhabi Grand Prix': 'united-arab-emirates'
        };

        const flagName = raceToCountry[raceName] || 'country-flag-default';
        document.getElementById('plot').innerHTML = `
            <div class="loading-container-row">
                <img src="/static/PNG Tyre.png"
                    class="spinning-tyre"
                    alt="Spinning Tyre">
            </div>
        `;
        updateProgressBar(25);          // 🔴 After loading spinner appears
        fetch('/get_graph', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                drivers: Array.from(selectedDrivers).map(driverBtn => driverBtn.dataset.driver),
                race: selectedRace,
                year: selectedYear,
                graph_types: Array.from(selectedGraphTypes)
            })
        })
        
        .then(response => {
            updateProgressBar(50);      // 🔴 Server responded
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error) });
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            updateProgressBar(70);      // 🔴 Just before processing
            const plotDiv = document.getElementById('plot');
            plotDiv.innerHTML = `
                <div class="loading-container-row">
                    <div class="loading-flag">${data.flag_emoji || '🏁'}</div>
                    <div class="loading-text">Finalizing ${data.event_name || 'race'} data...</div>
                </div>  
            `;
            
            if (data.weather) {
                const weatherContainer = document.getElementById('weather-info');
                weatherContainer.innerHTML = `
                    <h3>Weather Information</h3>
                    <div class="weather-grid">
                        <div class="weather-item">
                            <span class="weather-label">Air Temp</span>
                            <span class="weather-value">${data.weather.air_temp}°C</span>
                        </div>
                        <div class="weather-item">
                            <span class="weather-label">Track Temp</span>
                            <span class="weather-value">${data.weather.track_temp}°C</span>
                        </div>
                        <div class="weather-item">
                            <span class="weather-label">Humidity</span>
                            <span class="weather-value">${data.weather.humidity}%</span>
                        </div>
                        <div class="weather-item">
                            <span class="weather-label">Rainfall</span>
                            <span class="weather-value">${data.weather.rainfall}mm</span>
                        </div>
                    </div>
                `;
                weatherContainer.style.display = 'block'; // Show only when we have data
            } else {
                document.getElementById('weather-info').style.display = 'none'; // Hide if no data
            }

            setTimeout(() => {
                plotDiv.innerHTML = '';
                const graphsContainer = document.createElement('div');
                graphsContainer.className = 'graphs-container';
                const graphTypeOrder = ['laptimes', 'position', 'tyre', 'quali'];

                graphTypeOrder.forEach(graphType => {
                    const graphDiv = document.createElement('div');
                    graphDiv.className = 'graph-item';
                    graphDiv.id = `graph-${graphType}`;
                    const title = document.createElement('h3');
                    title.textContent = getGraphTitle(graphType);
                    graphDiv.appendChild(title);
                    graphsContainer.appendChild(graphDiv);
                });

                plotDiv.appendChild(graphsContainer);

                data.selected_graphs.forEach(graphType => {
                    if (data.figures[graphType]) {
                        const graphDiv = document.getElementById(`graph-${graphType}`);
                        if (graphDiv) {
                            Plotly.newPlot(graphDiv, {
                                data: data.figures[graphType].data,
                                layout: data.figures[graphType].layout
                            });
                        }
                    }
                });

                graphTypeOrder.forEach(graphType => {
                    if (!data.selected_graphs.includes(graphType)) {
                        const graphDiv = document.getElementById(`graph-${graphType}`);
                        if (graphDiv) {
                            graphDiv.style.display = 'none';
                        }
                    }
                });

                document.getElementById('graph-controls').style.display = 'block';
                // Auto maximize if only one graph is selected
                if (data.selected_graphs.length === 1) {
                    const onlyGraphType = data.selected_graphs[0];
                    const graphDiv = document.getElementById(`graph-${onlyGraphType}`);
                
                    document.querySelectorAll('.graph-item').forEach(item => {
                        if (item !== graphDiv) {
                            item.classList.add('hide');
                        }
                    });
                
                    graphDiv.classList.add('enlarged');
                    Plotly.Plots.resize(graphDiv).then(() => {
                        Plotly.relayout(graphDiv, { autosize: true });
                    });
                }

                completeProgressBar(); // ✅ Finish progress bar
            }, 100);
        })
        .catch(error => {
            resetProgressBar(); // ✅ Reset if error
            console.error('Error:', error);
            
            const message = error.message.includes("No data") || error.message.includes("400")
              ? "It looks like one of the selected drivers may not have completed any laps in this race (e.g., retired on lap 0). Please try deselecting them and generating the graph again."
              : error.message;
            
            // Optional: If your spinner is in another container, clear that too:
            const loader = document.querySelector('.loading-container');
            if (loader) loader.remove();

            // Kill spinner
            const plotDiv = document.getElementById('plot');
            plotDiv.innerHTML = `
              <div class="loading-container" style="border: 3px solidrgb(255, 255, 255); padding: 16px; border-radius: 8px; background-color: #e10600;">
                  <div class="loading-flag" style="font-size: 2em; text-align: center;">⚠️</div>
                  <div class="loading-text" style="font-weight: bold; font-size: 1.2em; text-align: center;">Error loading data</div>
                  <div class="error-details" style="color:rgb(255, 255, 255); margin-top: 10px; text-align: center;">${message}, please ensure the driver completed at least one race lap before retiring</div>
              </div>
            `;
          });
          
    });

    document.getElementById('export-btn').addEventListener('click', () => {
        const graphItems = document.querySelectorAll('.graph-item');
        if (graphItems.length === 0) return;

        graphItems.forEach((item) => {
            if (item.style.display !== 'none') {
                Plotly.toImage(item, { format: 'png', height: 1200, width: 1800 })
                .then(url => {
                    const graphType = item.id.replace('graph-', '');
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `f1_${graphType}_graph.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                });
            }
        });
    });

    document.querySelectorAll('input[name="graph-type"]').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedGraphTypes.add(e.target.value);
            } else {
                selectedGraphTypes.delete(e.target.value);
            }

            if (selectedGraphTypes.size === 0) {
                e.target.checked = true;
                selectedGraphTypes.add(e.target.value);
                showError('At least one graph type must be selected');
            } else {
                clearError();
            }
        });
    });
    // Show modal on double-click of the heading
    document.getElementById('site').addEventListener("dblclick", () => {
        const modal = document.getElementById("instructional-modal");
        modal.style.display = "block";
    });

    document.getElementById('plot').addEventListener('dblclick', (e) => {
        if (e.target.tagName === 'H3') {
            const graphItem = e.target.parentElement;
            document.querySelectorAll('.graph-item').forEach(item => {
                if (item !== graphItem) item.classList.add('hide');
            });
            graphItem.classList.add('enlarged');
            Plotly.Plots.resize(graphItem);
        }
    });

    document.addEventListener('keydown', async (e) => {
        if (e.key === 'Escape') {
            const enlargedItems = document.querySelectorAll('.graph-item.enlarged');
            const hiddenItems = document.querySelectorAll('.graph-item.hide');

            enlargedItems.forEach(item => item.classList.remove('enlarged'));
            hiddenItems.forEach(item => item.classList.remove('hide'));

            const allGraphItems = document.querySelectorAll('.graph-item');
            setTimeout(() => {
                allGraphItems.forEach(graph => {
                    Plotly.Plots.resize(graph).then(() => {
                        Plotly.relayout(graph, { autosize: true });
                    });
                });
            }, 150);
        }
    });
    

    loadRacesForYear(yearDropdown.value);
});
