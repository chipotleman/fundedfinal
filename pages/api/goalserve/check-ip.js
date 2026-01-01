export default async function handler(req, res) {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    
    res.status(200).json({
      outboundIP: data.ip,
      expectedIPs: ['52.70.127.138', '54.92.239.253'],
      isWhitelisted: ['52.70.127.138', '54.92.239.253'].includes(data.ip),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
