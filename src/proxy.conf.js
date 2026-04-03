const PROXY_CONFIG = [
  {
    context: ["/Auth", "/get_whatsapp","/whatsapp","/whatsapp-message","/hubs"],
    target: "http://16.170.205.169:5000",
    secure: false,
    changeOrigin: true,
    logLevel: "debug"
  }
];

module.exports = PROXY_CONFIG;
