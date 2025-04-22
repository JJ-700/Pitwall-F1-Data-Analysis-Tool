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

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    const yearDropdown = document.getElementById('year');
    const raceDropdown = document.getElementById('race');

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
                document.getElementById('load-drivers-btn').click();
            }
        })
        .catch(error => {
            raceDropdown.innerHTML = '<option value="">Error loading races</option>';
            showError('Failed to load races: ' + error.message);
        });
    }

    yearDropdown.addEventListener('change', () => {
        loadRacesForYear(yearDropdown.value);
    });

    document.getElementById('load-drivers-btn').addEventListener('click', () => {
        const selectedRace = document.getElementById('race').value;
        const selectedYear = document.getElementById('year').value;
        const driverContainer = document.getElementById('driver-buttons-container');
        
        // Clear existing elements and show loading IN ONE PLACE
        driverContainer.innerHTML = '<div class="loading-text-drivers">Loading drivers...</div>';
        document.getElementById('plot').innerHTML = '';
        document.getElementById('graph-controls').style.display = 'none';
        
        // Clear selected drivers
        selectedDrivers.clear();
        
        fetch('/get_drivers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                race: selectedRace,
                year: selectedYear
            })
        })
        .then(response => response.json())
        .then(data => {
            // Clear loading text by resetting container
            driverContainer.innerHTML = '';
            
            if (data.error) {
                showError(data.error);
            } else {
                createDriverButtons(data.drivers, data.driver_colors);
            }
        })
        .catch(error => {
            // Clear loading text and show error
            driverContainer.innerHTML = '';
            showError('Failed to load drivers: ' + error.message);
        });
    });

    // Generate graph
    document.getElementById('generate-btn').addEventListener('click', () => {
        const selectedRace = document.getElementById('race').value;
        const selectedYear = document.getElementById('year').value;
        const selectedDrivers = document.querySelectorAll(".driver-btn.active");
        const raceName = document.getElementById('race').options[document.getElementById('race').selectedIndex].text;

        // Country flag mapping
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
                 <!-- <img src="/static/${flagName}-flag.png"
                    class="country-flag"
                    alt="${raceName} flag"
                    onerror="this.src='/static/country-flag-default.png'; this.onerror=null;"> -->
                <img src="/static/PNG Tyre.png"
                    class="spinning-tyre"
                    alt="Spinning Tyre">
            </div>
        `;

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
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error) });
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }

            // Update loading display with chequered flag at the end
            const plotDiv = document.getElementById('plot');
            plotDiv.innerHTML = `
                <div class="loading-container-row">
                    <div class="loading-flag">${data.flag_emoji || '🏁'}</div>
                    <div class="loading-text">Loading ${data.event_name || 'race'} data...</div>
                </div>  
            `;

            // Give a small delay for the loading message to appear
            setTimeout(() => {
                // Now create the actual graphs
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
            }, 100); // Small delay to ensure loading message is visible
        })
        .catch(error => {
            showError(error.message);
            console.error('Error:', error);
            // Keep the loading display but show error
            document.getElementById('plot').innerHTML = `
                <div class="loading-container">
                    <div class="loading-flag">⚠️</div>
                    <div class="loading-text">Error loading data</div>
                    <div style="color: #ff6b6b; margin-top: 10px;">${error.message}</div>
                </div>
            `;
        });
    });

    // Export functionality
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

    // Graph type checkbox handling
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

    // Enlarge on title double-click
    document.getElementById('plot').addEventListener('dblclick', (e) => {
        if (e.target.tagName === 'H3') {
            const graphItem = e.target.parentElement;
            document.querySelectorAll('.graph-item').forEach(item => {
                if (item !== graphItem) item.classList.add('hide');
            });
            graphItem.classList.add('enlarged');
            // force Plotly to resize to new container dimensions
            Plotly.Plots.resize(graphItem);
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
            }, 150); // Small delay to ensure CSS changes are applied THIS IS CRITICAL
        }
    });

    // Auto-load on page load
    loadRacesForYear(yearDropdown.value);
});