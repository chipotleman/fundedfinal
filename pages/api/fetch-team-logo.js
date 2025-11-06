export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { team_name } = req.body;
  if (!team_name) {
    return res.status(400).json({ error: "Missing team_name" });
  }

  // Fetch from TheSportsDB
  try {
    const response = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(team_name)}`
    );
    const json = await response.json();
    const logo_url = json.teams?.[0]?.strTeamBadge || null;

    // TODO: Add database caching when needed

    return res.status(200).json({ logo_url });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
