const getFirebaseConfig = async () => {
    try {
        const response = await fetch('https://getfirebaseconfig-he3jhecsxa-uc.a.run.app');
        const config = await response.json();
        return config;
    } catch (error) {
        console.error('Error fetching Firebase config:', error);
        throw error;
    }
};

export default getFirebaseConfig;
