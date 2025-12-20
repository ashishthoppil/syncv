import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create admin client with service role key (bypasses RLS)
const getAdminClient = () => {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: "User ID is required.",
      });
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("job_tracker")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({
        success: false,
        message: error.message,
      });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error.message,
    });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { userId, organization, designation, initialScore, matchedKeywords, missingKeywords, keywordUniverse } = body;

    if (!userId || !organization || !designation) {
      return NextResponse.json({
        success: false,
        message: "User ID, organization, and designation are required.",
      });
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("job_tracker")
      .insert({
        user_id: userId,
        organization,
        designation,
        interview_status: "Applied",
        initial_score: initialScore || 0,
        matched_keywords: matchedKeywords || [],
        missing_keywords: missingKeywords || [],
        keyword_universe: keywordUniverse || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({
        success: false,
        message: error.message,
      });
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error.message,
    });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, interviewStatus } = body;

    if (!id || !interviewStatus) {
      return NextResponse.json({
        success: false,
        message: "Job ID and interview status are required.",
      });
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("job_tracker")
      .update({
        interview_status: interviewStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({
        success: false,
        message: error.message,
      });
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error.message,
    });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const userId = searchParams.get("userId");
    const deleteAll = searchParams.get("all");

    if (!id && !(userId && deleteAll)) {
      return NextResponse.json({
        success: false,
        message: "Job ID or userId with all=true is required.",
      });
    }

    const supabase = getAdminClient();
    let error = null;

    if (userId && deleteAll) {
      const res = await supabase
        .from("job_tracker")
        .delete()
        .eq("user_id", userId);
      error = res.error;
    } else if (id) {
      const res = await supabase.from("job_tracker").delete().eq("id", id);
      error = res.error;
    }

    if (error) {
      return NextResponse.json({
        success: false,
        message: error.message,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Job(s) deleted successfully.",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error.message,
    });
  }
}

