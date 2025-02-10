let productsData = null;
let selectedPlant = null;

async function loadProductsData() {
    try {
        // แก้ไข path การโหลด products.json
        const response = await fetch('../scr/data/products.json');
        productsData = await response.json();
        setupSearch();

        const params = new URLSearchParams(window.location.search);
        const type = params.get('type');
        const name = params.get('name');

        if (type && name) {
            const plant = productsData[type + 's'].find(p => p.name === name);
            if (plant) {
                selectedPlant = plant;
                document.getElementById('searchInput').value = plant.name;
                showPlantInfo();
            }
        }
    } catch (error) {
        console.error('Error loading products data:', error);
    }
}
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchDropdown = document.getElementById('searchDropdown');

    searchInput.addEventListener('focus', () => {
        const allPlants = [...(productsData.fruits || []), ...(productsData.vegetables || [])];
        displayDropdownResults(allPlants);
    });

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const allPlants = [...(productsData.fruits || []), ...(productsData.vegetables || [])];
        const matches = allPlants.filter(product =>
            product.name.toLowerCase().includes(searchTerm)
        );
        displayDropdownResults(matches);
    });

    document.addEventListener('click', (e) => {
        if (!searchDropdown.contains(e.target) && e.target !== searchInput) {
            searchDropdown.classList.add('hidden');
        }
    });
}

function displayDropdownResults(matches) {
    const searchDropdown = document.getElementById('searchDropdown');
    searchDropdown.innerHTML = '';

    if (matches.length > 0) {
        matches.forEach(product => {
            const div = document.createElement('div');
            div.className = 'p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-200 flex items-center gap-3';

            const img = document.createElement('img');
            img.src = product.image;
            img.alt = product.name;
            img.className = 'w-10 h-10 rounded-full object-cover';

            const name = document.createElement('span');
            name.textContent = product.name;

            div.appendChild(img);
            div.appendChild(name);

            div.addEventListener('click', () => {
                document.getElementById('searchInput').value = product.name;
                searchDropdown.classList.add('hidden');
                selectedPlant = product;
                showPlantInfo();
            });

            searchDropdown.appendChild(div);
        });
        searchDropdown.classList.remove('hidden');
    } else {
        searchDropdown.classList.add('hidden');
    }
}

function showPlantInfo() {
    const plantInfo = document.getElementById('plantInfo');
    const plantImage = document.getElementById('plantImage');
    const plantDetails = document.getElementById('plantDetails');

    if (!selectedPlant) {
        plantInfo.classList.add('hidden');
        return;
    }

    plantImage.src = selectedPlant.image;
    plantDetails.innerHTML = `
    ${selectedPlant.variety_name ? `<p><strong>พันธุ์:</strong> ${selectedPlant.variety_name}</p>` : ''}
    ${selectedPlant.growing_conditions && selectedPlant.growing_conditions.length > 0 ? `
      <p><strong>สภาพแวดล้อมที่เหมาะสม:</strong></p>
      <ul class="list-disc pl-5">
        ${selectedPlant.growing_conditions.map(c => `<li>${c}</li>`).join('')}
      </ul>
    ` : ''}
  `;
    plantInfo.classList.remove('hidden');
}

function calculatePlanting() {
    const totalArea = parseFloat(document.getElementById('totalArea').value);
    const areaUnit = document.getElementById('areaUnit').value;

    if (!totalArea || !selectedPlant) {
        alert('กรุณากรอกข้อมูลให้ครบถ้วน');
        return;
    }

    let areaInSqMeters;
    switch (areaUnit) {
        case 'rai':
            areaInSqMeters = totalArea * 1600;
            break;
        case 'sqwa':
            areaInSqMeters = totalArea * 4;
            break;
        case 'sqm':
            areaInSqMeters = totalArea;
            break;
    }

    const spacing = selectedPlant.planting_info?.spacing || 1;
    const plantCount = Math.ceil(areaInSqMeters / (spacing * spacing));

    const costPerPlant = selectedPlant.planting_info?.cost_per_plant || selectedPlant.price;
    const totalCost = plantCount * costPerPlant;
    const maintenanceCost = selectedPlant.planting_info?.maintenance_cost_per_rai || {};
    const totalMaintenanceCost = Math.ceil(totalArea *
        (maintenanceCost.fertilizer + maintenanceCost.water + maintenanceCost.pesticide || 0));

    document.getElementById('plantingResult').innerHTML = `
    <div class="text-xl mb-2">สรุปการคำนวณ</div>
    <div>สามารถปลูก ${selectedPlant.name} ได้ประมาณ ${plantCount.toLocaleString()} ต้น</div>
    <div>ระยะห่างระหว่างต้น ${spacing} เมตร</div>
  `;
}

function resetForm() {
    document.getElementById('searchInput').value = '';
    document.getElementById('totalArea').value = '';
    document.getElementById('plantInfo').classList.add('hidden');
    document.getElementById('plantingResult').innerHTML = '';
    document.getElementById('costEstimate').classList.add('hidden');
    selectedPlant = null;
}

loadProductsData();

// เพิ่มโค้ดนี้ต่อจากฟังก์ชัน loadProductsData
document.getElementById('calculateBtn').addEventListener('click', calculatePlanting);

document.getElementById('resetBtn').addEventListener('click', resetForm);
