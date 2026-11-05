const target = process.env.SELFIE_DEV_GATEWAY_URL;
if (!target) throw new Error('Start the development server with npm start to configure the API gateway.');

module.exports = {
  '/api/**': { target, secure: false, changeOrigin: false }
};
