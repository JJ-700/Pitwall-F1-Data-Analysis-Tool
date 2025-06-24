const selectedDrivers = new Set();

// Function to create driver buttons
function createDriverButtons(drivers, driverColors) {
    const container = document.getElementById('driver-buttons-container');
    container.innerHTML = '';
    
    // Create and add Select All button at the beginning
    const selectAllBtn = document.createElement('button');
    selectAllBtn.className = 'select-btn';
    selectAllBtn.textContent = '|';
    selectAllBtn.addEventListener('click', () => {
        container.querySelectorAll('.driver-btn').forEach(btn => {
            if (!btn.classList.contains('active')) {
                btn.click(); // Simulate click to select
            }
        });
    });
    container.appendChild(selectAllBtn);
    
    // Add all driver buttons
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
                btn.style.color = (bgColor.toLowerCase() === '#ffffff' || bgColor.toLowerCase() === '#fff') 
                    ? 'black' 
                    : 'white';
                selectedDrivers.add(btn.dataset.driver);
            } else {
                btn.style.backgroundColor = 'var(--f1-card)';
                btn.style.color = 'var(--f1-light)';
                selectedDrivers.delete(btn.dataset.driver);
            }
        });
        container.appendChild(btn);
    });
    
    // Create and add Deselect All button at the end
    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.className = 'select-btn';
    deselectAllBtn.textContent = '|';
    deselectAllBtn.addEventListener('click', () => {
        container.querySelectorAll('.driver-btn.active').forEach(btn => {
            btn.click(); // Simulate click to deselect
        });
    });
    container.appendChild(deselectAllBtn);
}

// Helper functions
function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
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
        'quali': 'Qualifying Results',
        'driver_standings': 'Driver Standings',
        'constructor_standings': 'Constructor Standings'
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

    }

    function loadDrivers() {
    const selectedRace = document.getElementById('race').value;
    const selectedYear = document.getElementById('year').value;
    const driverContainer = document.getElementById('driver-buttons-container');
    
    // Show loading state while preserving container structure
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
        if (data.error) {
            showError(data.error);
        } else {
            createDriverButtons(data.drivers, data.driver_colors);
        }
    })
    .catch(error => {
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
                flagNameSpan.textContent = race.name.replace(' Grand Prix', ' GP');
                
                flagItem.appendChild(flagImg);
                flagItem.appendChild(flagNameSpan);
                
                if (race.value === currentRace) {
                    flagItem.classList.add('active');
                }
                
                flagItem.addEventListener('click', (e) => {
                    // Prevent the normal race change behavior if Ctrl or Cmd key is pressed
                    if (e.ctrlKey || e.metaKey) {
                        scrollToTop();
                        // Select all drivers and generate all graphs
                        document.querySelectorAll('.flag-item').forEach(item => {
                            item.classList.remove('active');
                        });
                        flagItem.classList.add('active');
                        
                        // Change the race dropdown
                        const raceDropdown = document.getElementById('race');
                        raceDropdown.value = race.value;
                        
                        // Wait for drivers to load, then select all and generate graphs
                        const checkDriversLoaded = setInterval(() => {
                            const driverButtons = document.querySelectorAll('.driver-btn');
                            if (driverButtons.length > 0) {
                                clearInterval(checkDriversLoaded);
                                
                                // Select all drivers
                                driverButtons.forEach(btn => {
                                    if (!btn.classList.contains('active')) {
                                        btn.click(); // Simulate click to select
                                    }
                                });
                                
                                // Check all graph type checkboxes
                                const graphTypes = ['laptimes', 'position', 'tyre', 'quali'];
                                document.querySelectorAll('input[name="graph-type"]').forEach(checkbox => {
                                    checkbox.checked = graphTypes.includes(checkbox.value);
                                });
                                
                                // Click the generate button
                                setTimeout(() => {
                                    document.getElementById('generate-btn').click();
                                }, 300);
                            }
                        }, 100);
                        
                        // Trigger the race change
                        raceDropdown.dispatchEvent(new Event('change'));
                    } else {
                        // Normal behavior
                        document.querySelectorAll('.flag-item').forEach(item => {
                            item.classList.remove('active');
                        });
                        flagItem.classList.add('active');
                        
                        const raceDropdown = document.getElementById('race');
                        raceDropdown.value = race.value;
                        raceDropdown.dispatchEvent(new Event('change'));
                    }
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
   
    // Initialize carousel
    const slideContainer = document.getElementById('slideContainer');
    const slides = document.querySelectorAll('.slide');
    const totalSlides = slides.length;
    let currentSlide = 0;
    
    // Create slide indicators
    const indicatorsContainer = document.createElement('div');
    indicatorsContainer.className = 'slide-indicators';
    for (let i = 0; i < totalSlides; i++) {
        const indicator = document.createElement('div');
        indicator.className = 'slide-indicator';
        indicator.dataset.index = i;
        indicator.addEventListener('click', () => goToSlide(i));
        indicatorsContainer.appendChild(indicator);
    }
    document.querySelector('.carousel').appendChild(indicatorsContainer);
    updateIndicators();
    
    // Navigation hint
    const navigationHint = document.createElement('div');
    navigationHint.className = 'navigation-hint';
    navigationHint.textContent = '← → Arrow keys to navigate slides';
    document.querySelector('.carousel').appendChild(navigationHint);
    
    // Function to navigate to a specific slide
    function goToSlide(index) {
        if (index < 0) index = totalSlides - 1;
        else if (index >= totalSlides) index = 0;
        
        currentSlide = index;
        slideContainer.style.transform = `translateX(-${currentSlide * (100 / totalSlides)}%)`;
        updateIndicators();
        
        // Load data for slides when they become active
        if (currentSlide === 1) {
            generateStandingsGraph('driver_standings', 'driver-standings-container');
            generateStandingsGraph('constructor_standings', 'constructor-standings-container');
        }

    }
    
    // Update slide indicators
    function updateIndicators() {
        document.querySelectorAll('.slide-indicator').forEach((indicator, i) => {
            indicator.classList.toggle('active', i === currentSlide);
        });
    }
    
    // Show navigation hint temporarily
    function showNavigationHint() {
        navigationHint.style.display = 'block';
        setTimeout(() => {
            navigationHint.style.display = 'none';
        }, 2000);
    }
    
    // Function to generate standings graphs
    // Function to generate standings graphs
    function generateStandingsGraph(graphType, containerId) {
        const container = document.getElementById(containerId);
        const year = document.getElementById('year').value;
        
        // Create similar loading structure as race-specific graphs
        container.innerHTML = `
            <div class="loading-container-row">
                <img src="/static/PNG Tyre.png" class="spinning-tyre" alt="Loading">
                <div class="loading-text-drivers">Loading ${getGraphTitle(graphType)}...</div>
            </div>
        `;
        
        showProgressBar();
        updateProgressBar(20, `Loading ${getGraphTitle(graphType)} data...`);
        
        fetch('/get_graph', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                drivers: [],
                race: '',
                year: year,
                graph_types: [graphType]
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            // Clear container and create similar structure to race-specific graphs
            container.innerHTML = '';
            const graphsContainer = document.createElement('div');
            graphsContainer.className = 'graphs-container-standings';
            
            const graphDiv = document.createElement('div');
            graphDiv.className = 'graph-item-standings';
            graphDiv.id = `graph-${graphType}`;
            
            graphsContainer.appendChild(graphDiv);
            container.appendChild(graphsContainer);
            
            if (data.figures[graphType]) {
                Plotly.newPlot(graphDiv, data.figures[graphType].data, data.figures[graphType].layout);
            } else {
                throw new Error(`Graph data for ${graphType} not found`);
            }
            completeProgressBar();
        })
        .catch(error => {
            resetProgressBar();
            container.innerHTML = `
                <div class="loading-container" style="border: 3px solid rgb(255, 255, 255); padding: 16px; border-radius: 8px; background-color: #e10600;">
                    <div class="loading-flag" style="font-size: 2em; text-align: center;">⚠️</div>
                    <div class="loading-text" style="font-weight: bold; font-size: 1.2em; text-align: center;">Error loading data</div>
                    <div class="error-details" style="color: rgb(255, 255, 255); margin-top: 10px; text-align: center;">${error.message}</div>
                </div>
            `;
        });
    }

    document.getElementById('generate-btn').addEventListener('click', () => {
        const selectedRace = document.getElementById('race').value;
        const selectedYear = document.getElementById('year').value;
        const selectedDrivers = document.querySelectorAll(".driver-btn.active");
        const raceName = document.getElementById('race').options[document.getElementById('race').selectedIndex].text;
        const selectedGraphTypes = new Set(Array.from(
            document.querySelectorAll('input[name="graph-type"]:checked')
        ).map(input => input.value));

        // Special handling for standings
        const isStandingsOnly = selectedGraphTypes.has('driver_standings') || 
                                selectedGraphTypes.has('constructor_standings');
        const hasRaceSpecific = selectedGraphTypes.has('laptimes') || 
                                selectedGraphTypes.has('position') || 
                                selectedGraphTypes.has('tyre') || 
                                selectedGraphTypes.has('quali');
        
        if (hasRaceSpecific && selectedDrivers.length === 0) {
            alert("Please select at least one driver for race analysis graphs.");
            return;
        }
        
        if (!isStandingsOnly && !hasRaceSpecific) {
            alert("Please select at least one graph type.");
            return;
        }

        document.getElementById('headingmain').style.display = 'block';
        // Clear existing graphs and instruction text
        document.getElementById('plot').innerHTML = `
            <div class="loading-container-row">
                <img src="/static/PNG Tyre.png" class="spinning-tyre" alt="Loading">
                <div class="loading-text-drivers">Loading race data...</div>
            </div>
        `;
        document.getElementById('weather-info').style.display = 'none';
        document.getElementById('circuit-info').style.display = 'none';
    document.querySelectorAll("h2, .modal-text.graph-label").forEach(el => {
        if (!el.closest('.modal')) {  // Only hide if not inside a modal
            el.style.display = "none";
        }
    });

        showProgressBar();
        updateProgressBar(10, "Checking user input...");

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
            updateProgressBar(50, "Checking response...");
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error) });
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            updateProgressBar(70, "Processing graphs...");
            const plotDiv = document.getElementById('plot');
            plotDiv.innerHTML = '';
            const graphsContainer = document.createElement('div');
            graphsContainer.className = 'graphs-container';
            
            // Define desired order
            const graphTypeOrder = [
                'laptimes', 'position', 'tyre', 'quali', 
                'driver_standings', 'constructor_standings'
            ];
            
            graphTypeOrder.forEach(graphType => {
                if (data.figures[graphType]) {
                    const graphDiv = document.createElement('div');
                    graphDiv.className = 'graph-item';
                    graphDiv.id = `graph-${graphType}`;
                    
                    const title = document.createElement('h3');
                    title.textContent = getGraphTitle(graphType);
                    graphDiv.appendChild(title);
                    
                    graphsContainer.appendChild(graphDiv);
                }
            });

            plotDiv.appendChild(graphsContainer);

            // Render each graph
            Object.entries(data.figures).forEach(([graphType, figureData]) => {
                const graphDiv = document.getElementById(`graph-${graphType}`);
                if (graphDiv) {
                    Plotly.newPlot(graphDiv, figureData.data, figureData.layout);
                }
            });
            
            if (Object.keys(data.figures).length === 1) {
                const onlyGraphType = Object.keys(data.figures)[0];
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

            // Handle weather/circuit info
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

            document.getElementById('graph-controls').style.display = 'block';
            completeProgressBar();
        })
        .catch(error => {
            resetProgressBar();
            console.error('Error:', error);
            
            const message = error.message.includes("No data") || error.message.includes("400")
              ? "It looks like one of the selected drivers may not have completed any laps in this race (e.g., retired on lap 0). Please try deselecting them and generating the graph again."
              : error.message;
            
            const plotDiv = document.getElementById('plot');
            plotDiv.innerHTML = `
              <div class="loading-container" style="border: 3px solidrgb(255, 255, 255); padding: 16px; border-radius: 8px; background-color: #e10600;">
                  <div class="loading-flag" style="font-size: 2em; text-align: center;">⚠️</div>
                  <div class="loading-text" style="font-weight: bold; font-size: 1.2em; text-align: center;">Error loading data</div>
                  <div class="error-details" style="color:rgb(255, 255, 255); margin-top: 10px; text-align: center;">${message}</div>
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

    // Explicitly set backend to dark theme on load THIS WORKS
    fetch('/api/set-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: 'dark' })
    }).catch(error => {
        console.error('Error setting initial theme:', error);
    });

    // Normal theme toggle behavior
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
            // Regenerate graphs if any are displayed
            if (document.querySelector('.graph-item')) {
                const generateBtn = document.getElementById('generate-btn');
                if (generateBtn) {
                    generateBtn.click();
                }
            }
            generateStandingsGraph('driver_standings', 'driver-standings-container');
            generateStandingsGraph('constructor_standings', 'constructor-standings-container');
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

    // Accessibility modal toggle
    document.getElementById("accessability-instructions").addEventListener("click", function() {
        const modal = document.getElementById("accessability");
        if (modal.style.display === "block") {
            modal.style.display = "none";
        } else {
            closeAllModals();
            modal.style.display = "block";
        }
    });

    // Operation modal toggle
    document.getElementById("operation-instructions").addEventListener("click", function() {
        const modal = document.getElementById("instructions");
        if (modal.style.display === "block") {
            modal.style.display = "none";
        } else {
            closeAllModals();
            modal.style.display = "block";
        }
    });
    
    document.addEventListener('keydown', async (e) => {
        if (e.key === 'Escape') {
            const enlargedItems = document.querySelectorAll('.graph-item.enlarged');
            const hiddenItems = document.querySelectorAll('.graph-item.hide');
            closeAllModals(); // Close any open modals
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
        if (e.key === 'a' || e.key === 'A') {
            e.preventDefault(); // Prevent default browser behavior
            const modal = document.getElementById("accessability");
            if (modal.style.display === "block") {
                modal.style.display = "none";
            } else {
                closeAllModals();
                modal.style.display = "block";
            }
        }
        
        if (e.key === 'o' || e.key === 'O') {
            e.preventDefault(); // Prevent default browser behavior
            const modal = document.getElementById("instructions");
            if (modal.style.display === "block") {
                modal.style.display = "none";
            } else {
                closeAllModals();
                modal.style.display = "block";
            }
        }

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            goToSlide(currentSlide - 1);
            showNavigationHint();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            goToSlide(currentSlide + 1);
            showNavigationHint();
        }
        });
    loadRacesForYear(yearDropdown.value);
});