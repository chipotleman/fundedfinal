import { createClient } from "@supabase/supabase-js";

// Use your existing environment variables
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { team_name } = req.body;
  if (!team_name) {
    return res.status(400).json({ error: "Missing team_name" });
  }

  // Check Supabase cache
  const { data: existing, error: selectError } = await supabase
    .from("team_logos")
    .select("logo_url")
    .eq("team_name", team_name)
    .single();

  if (existing?.logo_url) {
    return res.status(200).json({ logo_url: existing.logo_url });
  }

  // Fetch from TheSportsDB
  try {
    const response = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(team_name)}`
    );
    const json = await response.json();
    const logo_url = json.teams?.[0]?.strTeamBadge || null;

    // Cache in Supabase if found
    if (logo_url) {
      await supabase.from("team_logos").insert({ team_name, logo_url });
    }

    return res.status(200).json({ logo_url });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
