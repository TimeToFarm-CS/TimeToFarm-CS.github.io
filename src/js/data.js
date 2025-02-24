import getFirebaseConfig from './config.js';

export async function initDataPage() {
    const firebaseConfig = await getFirebaseConfig();
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    let priceChart = null;
    // ----------------------------------------
    // ฟังก์ชันเรียก Cloud Function "predictPrices"
    // ----------------------------------------
    async function callCloudFunctionPredictPrices(productId, months = 2) {
        console.log("Sending productId to Cloud Functions:", productId);
        try {
            const predictPricesFn = firebase.functions().httpsCallable('predictPrices');
            const response = await predictPricesFn({ productId, months });
            console.log("Predictions received from Cloud Functions:", response.data);
            return response.data;
        } catch (error) {
            console.error("Error calling predictPrices:", error);
            console.warn("Error details:", {
                code: error.code,
                message: error.message,
                stack: error.stack,
                details: error.details,
            });
            return [];
        }
    }
    // ----------------------------------------
    // ฟังก์ชันสำหรับคำนวณการเฉลี่ย
    // ----------------------------------------
    function calculateAverages(items, type) {
        if (type === 'none') return items;

        const keyFormat = (date, type) => {
            const [day, month, year] = date.split('/');
            if (type === 'week') {
                const d = new Date(year, month - 1, day);
                d.setDate(d.getDate() - d.getDay());
                return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            } else if (type === 'month') {
                return `${year}-${month}`;
            }
        };

        const averages = items.reduce((acc, item) => {
            const key = keyFormat(item.date, type);
            if (!acc[key]) {
                acc[key] = {
                    sum_low: 0,
                    sum_high: 0,
                    count: 0,
                    dates: []
                };
            }
            acc[key].sum_low += item.low;
            acc[key].sum_high += item.high;
            acc[key].count += 1;
            acc[key].dates.push(item.date);
            return acc;
        }, {});

        return Object.values(averages).map(avg => ({
            date: avg.dates[0],
            low: Math.round(avg.sum_low / avg.count),
            high: Math.round(avg.sum_high / avg.count)
        }));
    }

    // ----------------------------------------
    // (ไม่ใช้ trainModel/predictFuturePrices ฝั่ง client เพราะให้ Cloud Functions ทำงานแทน)
    // ----------------------------------------

    // ----------------------------------------
    // ฟังก์ชันสำหรับแสดงกราฟ
    // ----------------------------------------
    function renderChart(data) {
        if (priceChart) priceChart.destroy();
        priceChart = new Chart(document.getElementById('priceChart'), {
            type: 'line',
            data: {
                labels: data.data.items.map(item => item.date),
                datasets: [
                    {
                        label: 'ราคาสูงสุด',
                        data: data.data.items.map(item => item.high),
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'ราคาต่ำสุด',
                        data: data.data.items.map(item => item.low),
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // ปิดการรักษา aspect ratio

                plugins: {
                    title: { display: true, text: 'ราคาย้อนหลัง' },
                    zoom: {
                        pan: { enabled: true, mode: 'x' },
                        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
                    },
                    tooltip: { mode: 'index', intersect: false }
                },
                interaction: { mode: 'index', intersect: false },
                scales: {
                    y: {
                        beginAtZero: true,
                        min: 0,
                        suggestedMax: Math.max(...data.data.items.map(item => item.high)) * 1.3,
                        title: { display: true, text: 'ราคา (บาท)' }
                    },
                    x: { title: { display: true, text: 'วันที่' } }
                }
            }
        });
    }

    // ----------------------------------------
    // ฟังก์ชันกรองข้อมูลและแสดงกราฟ
    // ----------------------------------------
    async function filterChartData(productId, startDate, endDate) {
        try {
            console.log("filterChartData -> productId:", productId);
            const doc = await db.collection('historical_prices').doc(productId.toString()).get();
            if (doc.exists) {
                const allDbItems = doc.data().priceData?.data?.items || [];

                // กรองเอาเฉพาะข้อมูลตั้งแต่ 1 ม.ค. 2024 ถึงปัจจุบัน
                const startOf2024 = new Date('2024-01-01');
                const now = new Date();

                const allPriceData = allDbItems.filter(item => {
                    const [day, month, year] = item.date.split('/');
                    const itemDate = new Date(year, month - 1, day);
                    return itemDate >= startOf2024 && itemDate <= now;
                });

                // กรองข้อมูลสำหรับกราฟ
                const filteredItems = allPriceData.filter(item => {
                    const [day, month, year] = item.date.split('/');
                    const itemDate = new Date(year, month - 1, day);
                    return itemDate >= startDate && itemDate <= endDate;
                });

                // เพิ่มการคัดออกข้อมูลที่เป็น 0 ก่อนคำนวณ
                const nonZeroItems = filteredItems.filter(item => item.low !== 0 && item.high !== 0);

                // เฉลี่ยตามที่ผู้ใช้เลือก (none, week, month)
                const averageType = document.getElementById('averageType').value;
                const processedItems = calculateAverages(nonZeroItems, averageType);

                const filteredData = { data: { items: processedItems } };
                renderChart(filteredData);
            }
        } catch (error) {
            console.error('Error loading price data:', error);
        }
    }

    // ----------------------------------------
    // ตัวอย่างฟังก์ชันใหม่ predictMonthlyPrices ที่เรียกใช้ Cloud Function
    // ----------------------------------------
    async function predictMonthlyPrices(productId) {
        try {
            const doc = await db.collection('historical_prices').doc(productId.toString()).get();
            if (!doc.exists) return;

            const allPriceData = doc.data().priceData?.data?.items || [];
            if (allPriceData.length === 0) return;

            // กรองข้อมูลตั้งแต่ 1 ม.ค. 2024 ถึงปัจจุบัน
            const start = new Date('2024-01-01');
            const end = new Date();
            const filtered = allPriceData.filter(item => {
                const [d, m, y] = item.date.split('/');
                const dt = new Date(y, m - 1, d);
                return dt >= start && dt <= end;
            });

            // เรียกข้อมูลทำนายจาก Cloud Functions
            const predictions = await callCloudFunctionPredictPrices(productId, 2);
            console.log("Received predictions:", predictions);

            // แปลงข้อมูลทำนายให้อยู่ในรูปแบบที่ต้องการ
            const predictionItems = predictions.map((pred, index) => {
                // คำนวณวันที่สำหรับเดือนถัดไป
                const currentDate = new Date();
                currentDate.setMonth(currentDate.getMonth() + index + 1);
                const mm = currentDate.getMonth() + 1;
                const yyyy = currentDate.getFullYear();

                return {
                    date: `ทำนาย ${mm}/${yyyy}`,
                    low: pred.low,
                    high: pred.high
                };
            });

            // คำนวณค่าเฉลี่ยรายเดือนของข้อมูลจริง
            const monthlyData = calculateAverages(filtered, 'month');

            // รวมข้อมูลจริงกับข้อมูลทำนาย
            const combinedItems = [...monthlyData, ...predictionItems];

            // แสดงผลในกราฟ
            const chartData = {
                data: { items: combinedItems }
            };
            renderChart(chartData);

        } catch (err) {
            console.error('Error in predictMonthlyPrices:', err);
        }
    }

    // ผูก event ให้ปุ่ม predictBtn เพื่อเรียกใช้ predictMonthlyPrices
    function attachPredictButton(productId) {
        const predictBtn = document.getElementById('predictBtn');
        if (!predictBtn) return;
        predictBtn.addEventListener('click', () => {
            predictMonthlyPrices(productId);
        });
    }

    async function loadProductData() {
        const params = new URLSearchParams(window.location.search);
        const type = params.get('type');
        const name = params.get('name');

        // แก้ไขการเรียก products.json
        const productsResponse = await fetch('../src/data/products.json');
        const productsData = await productsResponse.json();

        // ตรวจสอบว่ามี product ตรงกับเงื่อนไขหรือไม่
        const product = productsData[type + 's'].find(p => p.name.includes(name));
        if (!product) {
            console.error(`ไม่พบสินค้า: ชนิด "${type}" ชื่อ "${name}" ใน products.json`);
            return;
        }

        document.getElementById('productName').textContent = product.variety_name || product.name;
        document.getElementById('productImage').src = product.image;

        const productSizeSelect = document.getElementById('productSize');
        productSizeSelect.innerHTML = '';

        // ตรวจสอบว่าสินค้ามี size แยกย่อยหรือไม่
        if (product.sizes && product.sizes.length > 0) {
            productSizeSelect.style.display = 'block';
            product.sizes.forEach(size => {
                const option = document.createElement('option');
                option.value = size.id;
                option.textContent = size.size;
                productSizeSelect.appendChild(option);
            });
            // เริ่มด้วยขนาดแรกใน list
            setupDateFilters(product.sizes[0].id);
        } else {
            productSizeSelect.style.display = 'none';
            // ถ้าไม่มี sizes ให้ส่ง product.id แทน
            setupDateFilters(product.id);
        }

        const detailsList = document.getElementById('detailsList');
        detailsList.innerHTML = '';
        if (product.details) {
            product.details.forEach(detail => {
                const li = document.createElement('li');
                li.textContent = detail;
                detailsList.appendChild(li);
            });
        }

        const conditionsList = document.getElementById('conditionsList');
        conditionsList.innerHTML = '';
        if (product.growing_conditions) {
            product.growing_conditions.forEach(condition => {
                const li = document.createElement('li');
                li.textContent = condition;
                conditionsList.appendChild(li);
            });
        }

        document.getElementById('recommendedAreas').textContent = product.recommended_areas || '';
    }

    document.getElementById('productSize').addEventListener('change', (event) => {
        const selectedId = event.target.value;
        setupDateFilters(selectedId);
    });

    function setupDateFilters(productId) {
        // Log เพิ่มเติมเพื่อตรวจสอบ
        console.log("setupDateFilters -> productId:", productId);

        const fp = flatpickr("#dateRange", {
            mode: "range",
            dateFormat: "d/m/Y",
            locale: "th",
            onClose(selectedDates) {
                if (selectedDates.length === 2) {
                    filterChartData(productId, selectedDates[0], selectedDates[1]);
                }
            }
        });

        const averageSelect = document.getElementById('averageType');

        const periods = {
            '10days': { days: 10, average: 'none' },
            '1month': { days: 30, average: 'week' },
            '1year': { years: 1, average: 'month' }
        };

        function updateChart(periodKey) {
            const { days, years, average } = periods[periodKey];
            const endDate = new Date();
            const startDate = new Date(endDate);
            if (years) {
                startDate.setFullYear(endDate.getFullYear() - years);
            } else {
                startDate.setDate(endDate.getDate() - days);
            }

            // แสดงหรือซ่อนดรอปดาวน์ตามช่วงเวลา
            if (periodKey === '1year') {
                averageSelect.style.display = 'inline-block';
                if (!averageSelect.querySelector('option[value="month"]')) {
                    averageSelect.innerHTML += '<option value="month">เฉลี่ยรายเดือน</option>';
                }
            } else if (periodKey === '1month') {
                averageSelect.style.display = 'inline-block';
                const monthOption = averageSelect.querySelector('option[value="month"]');
                if (monthOption) monthOption.remove();
            } else {
                averageSelect.style.display = 'none';
                averageSelect.value = 'none';
            }

            averageSelect.value = average;

            fp.setDate([startDate, endDate], true);
            filterChartData(productId, startDate, endDate);
        }

        function setActiveButton(activeButtonId) {
            ['10days', '1month', '1year'].forEach(id => {
                document.getElementById(id).className = 'px-4 py-2 bg-white text-gray-700';
            });
            document.getElementById(activeButtonId).className = 'px-4 py-2 bg-green-500 text-white';
        }

        ['10days', '1month', '1year'].forEach(id => {
            document.getElementById(id).addEventListener('click', () => {
                updateChart(id);
                setActiveButton(id);
            });
        });

        averageSelect.addEventListener('change', () => {
            const selectedDates = fp.selectedDates;
            if (selectedDates.length === 2) {
                filterChartData(productId, selectedDates[0], selectedDates[1]);
            }
        });

        // ผูก event ให้ปุ่ม predictBtn
        attachPredictButton(productId);

        updateChart('10days');
        setActiveButton('10days');
    }

    loadProductData();
}
