export default async function handler(req, res) {
  if (req.method === 'GET') {
    const settings = {
      siteName: 'Piks',
      betaMode: true,
      maintenanceMode: false,
      demoEnabled: true,
      challengeTiers: {
        starter: { price: 149, funding: 5000, profitSplit: 90 },
        pro: { price: 249, funding: 10000, profitSplit: 90 },
        elite: { price: 399, funding: 25000, profitSplit: 90 },
      },
      challengeRules: {
        minPicks: 20,
        minRiskPercent: 1,
        maxRiskPercent: 5,
        maxDailyLoss: 10,
        maxDrawdown: 15,
        profitTarget: 20,
        cashoutFee: 10,
        inactivityDays: 5,
      },
    };
    return res.status(200).json(settings);
  }

  if (req.method === 'POST') {
    const newSettings = req.body;
    console.log('Saving settings:', newSettings);
    return res.status(200).json({ success: true, message: 'Settings saved' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
