import getFirebaseConfig from './config.js';

export async function initHomepage() {
    const firebaseConfig = await getFirebaseConfig();
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const searchDropdown = document.getElementById('searchDropdown');
    const priceFilter = document.getElementById('priceFilter');
    const fruitsSection = document.getElementById('fruits-section');
    const vegetablesSection = document.getElementById('vegetables-section');
    let allProducts = [];
    let productsLoaded = false;

    async function loadProducts() {
        if (productsLoaded) return; // ตรวจสอบว่ามีการโหลดข้อมูลแล้วหรือยัง
        try {
            // แก้ไขการเรียก products.json
            const response = await fetch('../src/data/products.json');
            const priceSnapshot = await db.collection('historical_prices').get();
            const data = await response.json();

            const priceDataMap = {};
            priceSnapshot.forEach(doc => {
                priceDataMap[doc.id] = doc.data().priceData;
            });

            allProducts = [
                ...data.fruits.map(f => ({
                    ...f,
                    type: 'fruit',
                    priceData: priceDataMap[f.id.toString()]
                })),
                ...data.vegetables.map(v => ({
                    ...v,
                    type: 'vegetable',
                    priceData: priceDataMap[v.id.toString()]
                }))
            ];

            productsLoaded = true; // ตั้งค่าว่าข้อมูลถูกโหลดแล้ว

            displayProducts();
            setupSearch();
            setupFilter();
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    function displayProducts() {
        const template = document.getElementById('product-card');

        const fruitsContainer = document.getElementById('fruits-container');
        fruitsContainer.innerHTML = '';
        const fruits = allProducts.filter(p => p.type === 'fruit');

        // ใช้ DocumentFragment สำหรับผลไม้
        const fruitsFragment = document.createDocumentFragment();
        for (const fruit of fruits) {
            const latestPrice = fruit.priceData?.data?.items[fruit.priceData.data.items.length - 1];

            const card = template.content.cloneNode(true);
            const cardLink = card.querySelector('a');
            cardLink.href = `data.html?type=fruit&name=${encodeURIComponent(fruit.name)}`;
            cardLink.querySelector('img').src = fruit.image;
            cardLink.querySelector('img').alt = fruit.name;
            cardLink.querySelector('h4').textContent = fruit.name;
            cardLink.querySelector('.text-green-600').textContent =
                latestPrice ? `฿${latestPrice.low} - ${latestPrice.high} / ${fruit.unit}` : 'ไม่มีข้อมูล';
            cardLink.querySelector('.text-gray-500').textContent =
                latestPrice ? latestPrice.date : 'ไม่มีข้อมูล';
            fruitsFragment.appendChild(card);
        }
        fruitsContainer.appendChild(fruitsFragment);

        const vegetablesContainer = document.getElementById('vegetables-container');
        vegetablesContainer.innerHTML = '';
        const vegetables = allProducts.filter(p => p.type === 'vegetable');

        // ใช้ DocumentFragment สำหรับผัก
        const vegetablesFragment = document.createDocumentFragment();
        for (const vegetable of vegetables) {
            const latestPrice = vegetable.priceData?.data?.items[vegetable.priceData.data.items.length - 1];

            const card = template.content.cloneNode(true);
            const cardLink = card.querySelector('a');
            cardLink.href = `data.html?type=vegetable&name=${encodeURIComponent(vegetable.name)}`;
            cardLink.querySelector('img').src = vegetable.image;
            cardLink.querySelector('img').alt = vegetable.name;
            cardLink.querySelector('h4').textContent = vegetable.name;
            cardLink.querySelector('.text-green-600').textContent =
                latestPrice ? `฿${latestPrice.low} - ${latestPrice.high} / ${vegetable.unit}` : 'ไม่มีข้อมูล';
            cardLink.querySelector('.text-gray-500').textContent =
                latestPrice ? latestPrice.date : 'ไม่มีข้อมูล';
            vegetablesFragment.appendChild(card);
        }
        vegetablesContainer.appendChild(vegetablesFragment);
    }

    function debounce(fn, delay) {
        let timeoutID;
        return function (...args) {
            clearTimeout(timeoutID);
            timeoutID = setTimeout(() => {
                fn.apply(this, args);
            }, delay);
        };
    }

    function setupSearch() {
        const handleSearchInput = debounce((e) => {
            const searchTerm = e.target.value.toLowerCase();
            if (searchTerm.length < 2) {
                searchDropdown.classList.add('hidden');
                return;
            }

            const matches = allProducts.filter(product =>
                product.name.toLowerCase().includes(searchTerm)
            );

            displayDropdownResults(matches);
        }, 300);

        searchInput.addEventListener('input', handleSearchInput);

        searchButton.addEventListener('click', () => {
            filterProducts(searchInput.value);
        });

        document.addEventListener('click', (e) => {
            if (!searchDropdown.contains(e.target) && e.target !== searchInput) {
                searchDropdown.classList.add('hidden');
            }
        });
    }

    function setupFilter() {
        priceFilter.addEventListener('change', () => {
            const selectedType = priceFilter.value;
            filterByType(selectedType);
        });
    }

    function filterByType(type) {
        if (type === 'all') {
            fruitsSection.style.display = 'block';
            vegetablesSection.style.display = 'block';
        } else if (type === 'fruit') {
            fruitsSection.style.display = 'block';
            vegetablesSection.style.display = 'none';
        } else if (type === 'vegetable') {
            fruitsSection.style.display = 'none';
            vegetablesSection.style.display = 'block';
        }
    }

    function displayDropdownResults(matches) {
        searchDropdown.innerHTML = '';

        if (matches.length > 0) {
            // ใช้ DocumentFragment สำหรับผลลัพธ์การค้นหา
            const dropdownFragment = document.createDocumentFragment();
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
                    window.location.href = `data.html?type=${product.type}&name=${encodeURIComponent(product.name)}`;
                });

                dropdownFragment.appendChild(div);
            });
            searchDropdown.appendChild(dropdownFragment);
            searchDropdown.classList.remove('hidden');
        } else {
            searchDropdown.classList.add('hidden');
        }
    }

    function filterProducts(searchTerm) {
        searchTerm = searchTerm.toLowerCase();
        const allCards = document.querySelectorAll('#fruits-container a, #vegetables-container a');

        allCards.forEach(card => {
            const productName = card.querySelector('h4').textContent.toLowerCase();
            if (productName.includes(searchTerm)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    loadProducts();
}
