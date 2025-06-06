src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
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
        btn.dataset.color = driverColors[driver] || '#4f4f4f';
        btn.textContent = driver;
        
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
                btn.style.backgroundColor = 'var(--f1-card)';
                btn.style.color = 'var(--f1-light)';                   
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

function updateProgressBar(percent, message = "") {
    const container = document.getElementById('progress-bar-container');
    const bar = document.getElementById('progress-bar');
    const msg = document.getElementById('progress-message');

    container.style.display = 'block';           // Ensure it's visible
    bar.style.width = percent + '%';            // Update width
    msg.textContent = message;                  // Update message
    msg.style.color = 'var(--f1-red)';         // Ensure text is visible
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

    // Define raceToCountry at the top level of the event listener
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
                loadSeasonFlags(year, data.races); // Pass the races data to avoid duplicate fetch
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

    function loadSeasonFlags(year, racesData = null) {
        const flagsContainer = document.getElementById('flags-container');
        flagsContainer.innerHTML = '<div class="loading-text-drivers">Loading flags...</div>';
        
        if (racesData) {
            renderFlags(racesData);
        } else {
            fetch('/get_races', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year: year })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                renderFlags(data.races);
            })
            .catch(error => {
                flagsContainer.innerHTML = '<div class="error-text">Failed to load flags</div>';
                console.error('Error loading flags:', error);
            });
        }

        function renderFlags(races) {
            flagsContainer.innerHTML = '';
            const currentRace = document.getElementById('race').value;
            
            races.forEach(race => {
                const flagName = raceToCountry[race.name] || 'default';
                const flagItem = document.createElement('div');
                flagItem.className = 'flag-item';
                flagItem.title = race.name;
                flagItem.setAttribute('data-race-value', race.value);
                
                const flagImg = document.createElement('img');
                flagImg.src = `/static/${flagName}-flag.png`;
                flagImg.alt = race.name;
                flagImg.className = 'flag-img';
                flagImg.onerror = function() {
                    this.src = '/static/australia-flag.png';
                };
                
                const flagNameSpan = document.createElement('span');
                flagNameSpan.className = 'flag-name';
                flagNameSpan.textContent = race.name.replace(' Grand Prix', '');
                
                flagItem.appendChild(flagImg);
                flagItem.appendChild(flagNameSpan);
                
                if (race.value === currentRace) {
                    flagItem.classList.add('active');
                }
                
                flagItem.addEventListener('click', () => {
                    document.querySelectorAll('.flag-item').forEach(item => {
                        item.classList.remove('active');
                    });
                    flagItem.classList.add('active');
                    
                    const raceDropdown = document.getElementById('race');
                    raceDropdown.value = race.value;
                    raceDropdown.dispatchEvent(new Event('change'));
                });
                
                flagsContainer.appendChild(flagItem);
            });
        }
    }


    yearDropdown.addEventListener('change', () => {
        document.getElementById('plot').innerHTML = '';
        document.getElementById('weather-info').style.display = 'none';
        document.getElementById('circuit-info').style.display = 'none';
        loadRacesForYear(yearDropdown.value);
    });

    raceDropdown.addEventListener('change', () => {
        // Update flag highlights
        document.querySelectorAll('.flag-item').forEach(item => {
            item.classList.remove('active');
        });
        const currentRace = document.getElementById('race').value;
        document.querySelectorAll('.flag-item').forEach(item => {
            if (item.getAttribute('data-race-value') === currentRace) {
                item.classList.add('active');
            }
        })
        document.getElementById('plot').innerHTML = '';
        document.getElementById('weather-info').style.display = 'none';
        document.getElementById('circuit-info').style.display = 'none';
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
        document.querySelectorAll("h2, .modal-text.graph-label").forEach(el => {
            el.style.display = "none";
        });


        showProgressBar();
        updateProgressBar(10, "Checking user input...");

        const flagName = raceToCountry[raceName] || 'country-flag-default';
        document.getElementById('plot').innerHTML = `
            <div class="loading-container-row">
                <img src="/static/PNG Tyre.png"
                    class="spinning-tyre"
                    alt="Spinning Tyre">
            </div>
        `;
        updateProgressBar(15,"Preparing backend request...");
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
            updateProgressBar(50,"Checking response...");
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error) });
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            updateProgressBar(70,"Processing graphs...");
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
                            <span class="weather-label">Total Rainfall</span>
                            <span class="weather-value">${data.weather.rainfall}mm</span>
                        </div>
                    </div>
                `;
                weatherContainer.style.display = 'block';
            } else {
                document.getElementById('weather-info').style.display = 'none';
            }

            if (data.circuit_info) {
                const circuitContainer = document.getElementById('circuit-info');
                const raceName = document.getElementById('race').options[document.getElementById('race').selectedIndex].text;
                const flagName = raceToCountry[raceName] || 'default';
                
                circuitContainer.innerHTML = `
                    <h3>Circuit Information</h3>
                    <div class="weather-grid">
                        <div class="weather-item">
                            <span class="weather-label">Location</span>
                            <span class="weather-value">${data.circuit_info.location}</span>
                        </div>
                        <div class="weather-item">
                            <span class="weather-label">Length</span>
                            <span class="weather-value">${data.circuit_info.length_km} km</span>
                        </div>
                        <div class="weather-item">
                            <span class="weather-label">Turns</span>
                            <span class="weather-value">${data.circuit_info.turns}</span>
                        </div>
                        <div class="weather-item">
                            <span class="weather-label">Lap Record</span>
                            <span class="weather-value">${data.circuit_info.lap_record}</span>
                        </div>
                    </div>
                `;
                circuitContainer.style.display = 'block';
            } else {
                document.getElementById('circuit-info').style.display = 'none';
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

                completeProgressBar();
            }, 100);
        })
        .catch(error => {
            resetProgressBar();
            console.error('Error:', error);
            
            const message = error.message.includes("No data") || error.message.includes("400")
              ? "It looks like one of the selected drivers may not have completed any laps in this race (e.g., retired on lap 0). Please try deselecting them and generating the graph again."
              : error.message;
            
            const loader = document.querySelector('.loading-container');
            if (loader) loader.remove();

            const plotDiv = document.getElementById('plot');
            plotDiv.innerHTML = `
              <div class="loading-container" style="border: 3px solidrgb(255, 255, 255); padding: 16px; border-radius: 8px; background-color: #e10600;">
                  <div class="loading-flag" style="font-size: 2em; text-align: center;">⚠️</div>
                  <div class="loading-text" style="font-weight: bold; font-size: 1.2em; text-align: center;">Error loading data</div>
                  <div class="error-details" style="color:rgb(255, 255, 255); margin-top: 10px; text-align: center;">${message}, please ensure the driver(s) completed at least one race lap before retiring</div>
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

    const toggleBtn = document.getElementById('theme-toggle');
    const root = document.documentElement;

    // Set default to dark theme
    root.setAttribute('data-theme', 'dark');
    toggleBtn.textContent = 'Switch to Light Mode';

    toggleBtn.addEventListener('click', () => {
        const currentTheme = root.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        // Update UI immediately
        root.setAttribute('data-theme', newTheme);
        toggleBtn.textContent = newTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
        
        // Send theme to backend
        fetch('/api/set-theme', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme: newTheme })
        })
        .then(() => {
            // If graphs are currently displayed, simulate Generate button click
            if (document.querySelector('.graph-item')) {
                const generateBtn = document.getElementById('generate-btn');
                if (generateBtn) {
                    generateBtn.click(); // This will reuse existing generation code
                }
            }
        })
        .catch(error => {
            console.error('Error updating theme:', error);
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

    document.getElementById("accessability-instructions").addEventListener("click", function() {
        const instructions = document.getElementById("accessability");
        if (instructions) {
            instructions.style.display = "block";
        } else {
            console.error('Element with ID "accessability" not found.');
        }
    });
    
    document.addEventListener('keydown', async (e) => {
        if (e.key === 'Escape') {
            const enlargedItems = document.querySelectorAll('.graph-item.enlarged');
            const hiddenItems = document.querySelectorAll('.graph-item.hide');

            // Remove classes first
            enlargedItems.forEach(item => item.classList.remove('enlarged'));
            hiddenItems.forEach(item => item.classList.remove('hide'));

            // Alternative 2: Use setTimeout to allow DOM to update before resizing
            const allGraphItems = document.querySelectorAll('.graph-item');
            setTimeout(() => {
                allGraphItems.forEach(graph => {
                    Plotly.Plots.resize(graph).then(() => {
                        Plotly.relayout(graph, {autosize: true});
                    });
                });
            }, 170); // Small delay to ensure CSS changes are applied THIS IS CRITICAL
        }
        // Add this new condition for the "A" key
        if (e.key === 'a' || e.key === 'A') {
            const modal = document.getElementById("accessability");
            if (modal) {
                modal.style.display = modal.style.display === "none" || !modal.style.display ? "block" : "none";
            }
        }   
    });
    loadRacesForYear(yearDropdown.value);
});