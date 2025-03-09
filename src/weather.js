const axios = require('axios');
const { weatherApiKey } = require('./config');

async function getWeather(city) {
    try {
        const response = await axios.get(`http://api.openweathermap.org/data/2.5/weather`, {
            params: {
                q: city,
                appid: weatherApiKey,
                units: 'metric',
                lang: 'pt_br'
            }
        });

        const weather = response.data;
        return `
        Clima em ${weather.name}:
        🌡️ Temperatura: ${Math.round(weather.main.temp)}°C
        💧 Umidade: ${weather.main.humidity}%
        🌤️ Condição: ${weather.weather[0].description}
        🌪️ Vento: ${Math.round(weather.wind.speed * 3.6)} km/h`;
    } catch (error) {
        if (error.response?.status === 404) {
            return `Desculpe, não encontrei dados para a cidade "${city}".`;
        }
        throw error;
    }
}

function extractCityFromMessage(message) {
    const patterns = [
        /clima\s+(?:em|de|para)\s+(.+)/i,
        /(?:como|qual)\s+(?:está|é)\s+o\s+clima\s+(?:em|de)\s+(.+)/i,
        /tempo\s+(?:em|de|para)\s+(.+)/i,
        /previsão\s+(?:em|de|para)\s+(.+)/i
    ];

    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match) return match[1].trim();
    }
    return null;
}

module.exports = {
    getWeather,
    extractCityFromMessage
};