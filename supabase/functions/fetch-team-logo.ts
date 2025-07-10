import { serve } from "std/server";
import { createClient } from "@supabase/supabase-js";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );

  try {
    const { team_name } = await req.json();
    if (!team_name) {
      return new Response(JSON.stringify({ error: "Missing team_name" }), { status: 400 });
    }

    // Check cache
    const { data: existing, error: selectError } = await supabase
      .from("team_logos")
      .select("logo_url")
      .eq("team_name", team_name)
      .single();

    if (existing?.logo_url) {
      return new Response(JSON.stringify({ logo_url: existing.logo_url }), { headers: { "Content-Type": "application/json" } });
    }

    // Fetch from TheSportsDB
    const response = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(team_name)}`);
    const json = await response.json();
    const logo_url = json.teams?.[0]?.strTeamBadge || null;

    // Cache if found
    if (logo_url) {
      await supabase.from("team_logos").insert({ team_name, logo_url });
    }

    return new Response(JSON.stringify({ logo_url }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
});
