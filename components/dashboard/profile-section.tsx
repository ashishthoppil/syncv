"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { toast } from "react-toastify";

type ProfileSectionProps = {
  user: {
    id?: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  } | null;
};

export const ProfileSection = ({ user }: ProfileSectionProps) => {
  const [email, setEmail] = useState((user?.email as string) || "");
  const [fullName, setFullName] = useState(
    (user?.user_metadata?.full_name as string) || ""
  );
  const [headline, setHeadline] = useState(
    (user?.user_metadata?.headline as string) || ""
  );
  const [phone, setPhone] = useState(
    (user?.user_metadata?.phone as string) || ""
  );
  const [behance, setBehance] = useState(
    (user?.user_metadata?.behance as string) || ""
  );
  const [github, setGithub] = useState(
    (user?.user_metadata?.github as string) || ""
  );
  const [linkedin, setLinkedin] = useState(
    (user?.user_metadata?.linkedin as string) || ""
  );
  const [portfolio, setPortfolio] = useState(
    (user?.user_metadata?.portfolio as string) || ""
  );
  const [otherLink, setOtherLink] = useState(
    (user?.user_metadata?.other_link as string) || ""
  );
  const [city, setCity] = useState((user?.user_metadata?.city as string) || "");
  const [country, setCountry] = useState(
    (user?.user_metadata?.country as string) || ""
  );
  const [experienceYears, setExperienceYears] = useState(
    user?.user_metadata?.experience_years
      ? String(user.user_metadata.experience_years)
      : ""
  );
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsingResume, setParsingResume] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoFileName, setPhotoFileName] = useState("");
  const [photoPreview, setPhotoPreview] = useState(
    (user?.user_metadata?.photo_url as string) || ""
  );
  const [photoStoragePath, setPhotoStoragePath] = useState(
    (user?.user_metadata?.photo_url as string) || ""
  );

  const initials = fullName
    ? fullName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "Y";
  const displayName = fullName || user?.email || "";

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;
      setLoadingProfile(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        toast.error("Failed to load profile.");
        setLoadingProfile(false);
        return;
      }

      if (data) {
        setFullName(data.full_name || "");
        setEmail(data.email || user.email || "");
        setHeadline(data.headline || "");
        setPhone(data.phone || "");
        setBehance(data.behance || "");
        setGithub(data.github || "");
        setLinkedin(data.linkedin || "");
        setPortfolio(data.portfolio || "");
        setOtherLink(data.other_link || "");
        setCity(data.city || "");
        setCountry(data.country || "");
        setExperienceYears(
          data.experience_years !== null && data.experience_years !== undefined
            ? String(data.experience_years)
            : ""
        );
        if (data.photo_url) {
          setPhotoStoragePath(data.photo_url);
          await refreshPhotoPreview(data.photo_url);
        }
      } else {
        setEmail(user.email || "");
      }
      setLoadingProfile(false);
    };

    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const refreshPhotoPreview = async (pathOrUrl: string) => {
    if (!pathOrUrl) return;
    const isUrl = pathOrUrl.startsWith("http");
    if (isUrl) {
      setPhotoPreview(pathOrUrl);
      return;
    }
    const { data, error } = await supabase.storage
      .from("profile-photos")
      .createSignedUrl(pathOrUrl, 60 * 60 * 24);
    if (!error && data?.signedUrl) {
      setPhotoPreview(data.signedUrl);
    }
  };

  const parseResumeForProfile = (resumeText: string) => {
    const result: Partial<
      Record<
        | "fullName"
        | "email"
        | "phone"
        | "headline"
        | "behance"
        | "github"
        | "linkedin"
        | "portfolio"
        | "otherLink"
        | "experienceYears",
        string
      >
    > = {};

    const emailMatch = resumeText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (emailMatch) result.email = emailMatch[0];

    const phoneMatch = resumeText.match(/(\+?\d[\d\s().-]{7,}\d)/);
    if (phoneMatch) result.phone = phoneMatch[0].trim();

    const findLink = (key: string) => {
      const regex = new RegExp(`https?:\\/\\/[^\\s]*${key}[^\\s]*`, "i");
      const match = resumeText.match(regex);
      return match ? match[0] : undefined;
    };
    result.behance = findLink("behance");
    result.github = findLink("github");
    result.linkedin = findLink("linkedin");
    result.portfolio =
      findLink("portfolio") ||
      findLink("resume") ||
      findLink("about") ||
      findLink("me");

    const yearsMatch = resumeText.match(/(\d+(?:\.\d+)?)\s*\+?\s*(years|yrs)/i);
    if (yearsMatch) result.experienceYears = yearsMatch[1];

    const lines = resumeText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length) {
      const maybeName = lines[0];
      const looksLikeName =
        maybeName.split(" ").length <= 5 &&
        !maybeName.toLowerCase().includes("@") &&
        !/\d/.test(maybeName);
      if (looksLikeName) {
        result.fullName = maybeName;
      }
      const secondLine = lines[1];
      if (secondLine && secondLine.length < 120 && !secondLine.includes("@")) {
        result.headline = secondLine;
      }
    }

    return result;
  };

  const applyParsedProfile = (parsed: ReturnType<typeof parseResumeForProfile>) => {
    if (parsed.fullName) setFullName(parsed.fullName);
    if (parsed.phone) setPhone(parsed.phone);
    if (parsed.headline) setHeadline(parsed.headline);
    if (parsed.behance) setBehance(parsed.behance);
    if (parsed.github) setGithub(parsed.github);
    if (parsed.linkedin) setLinkedin(parsed.linkedin);
    if (parsed.portfolio) setPortfolio(parsed.portfolio);
    if (parsed.otherLink) setOtherLink(parsed.otherLink);
    if (parsed.experienceYears) setExperienceYears(parsed.experienceYears);
  };

  const buildProfilePayload = (overrides: Partial<Record<string, unknown>> = {}) => {
    const stableEmail = user?.email || email;
    return {
      email: stableEmail,
      full_name: (overrides.fullName as string) ?? fullName,
      headline: (overrides.headline as string) ?? headline,
      phone: (overrides.phone as string) ?? phone,
      behance: (overrides.behance as string) ?? behance,
      github: (overrides.github as string) ?? github,
      linkedin: (overrides.linkedin as string) ?? linkedin,
      portfolio: (overrides.portfolio as string) ?? portfolio,
      other_link: (overrides.otherLink as string) ?? otherLink,
      city: (overrides.city as string) ?? city,
      country: (overrides.country as string) ?? country,
      experience_years:
        overrides.experienceYears !== undefined
          ? Number(overrides.experienceYears)
          : experienceYears
          ? Number(experienceYears)
          : null,
      photo_url: (overrides.photo_url as string) ?? photoStoragePath,
    };
  };

  const persistProfile = async (overrides: Partial<Record<string, unknown>> = {}) => {
    if (!user?.id) {
      toast.error("No user session. Please log in again.");
      return;
    }
    setSaving(true);

    try {
      let uploadedPhotoUrl = photoPreview;
      let uploadedPhotoPath = photoStoragePath;

      if (photoFile) {
        const fileExt = photoFile.name.split(".").pop();
        const filePath = `${user.id}/avatar-${Date.now()}.${
          fileExt || "jpg"
        }`;
        const { error: uploadError } = await supabase.storage
          .from("profile-photos")
          .upload(filePath, photoFile, { upsert: true });

        if (uploadError) {
          throw uploadError;
        }

        const { data, error } = await supabase.storage
          .from("profile-photos")
          .createSignedUrl(filePath, 60 * 60 * 24);

        if (error) {
          throw error;
        }

        uploadedPhotoPath = filePath;
        uploadedPhotoUrl = data?.signedUrl || "";
        setPhotoStoragePath(filePath);
        setPhotoPreview(uploadedPhotoUrl);
      }

      const profilePayload = buildProfilePayload({
        ...overrides,
        photo_url: uploadedPhotoPath,
      });

      const { error: updateError } = await supabase.auth.updateUser({
        email: profilePayload.email,
        data: {
          full_name: profilePayload.full_name,
          headline: profilePayload.headline,
          phone: profilePayload.phone,
          behance: profilePayload.behance,
          github: profilePayload.github,
          linkedin: profilePayload.linkedin,
          portfolio: profilePayload.portfolio,
          other_link: profilePayload.other_link,
          city: profilePayload.city,
          country: profilePayload.country,
          experience_years: profilePayload.experience_years,
          photo_url: profilePayload.photo_url,
        },
      });

      if (updateError) {
        throw updateError;
      }

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user?.id,
        email: profilePayload.email,
        full_name: profilePayload.full_name,
        headline: profilePayload.headline,
        phone: profilePayload.phone,
        behance: profilePayload.behance,
        github: profilePayload.github,
        linkedin: profilePayload.linkedin,
        portfolio: profilePayload.portfolio,
        other_link: profilePayload.other_link,
        city: profilePayload.city,
        country: profilePayload.country,
        experience_years: profilePayload.experience_years,
        photo_url: profilePayload.photo_url,
      });

      if (profileError) {
        throw profileError;
      }

      toast.success("Profile saved to Supabase.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save profile.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await persistProfile();
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (photoPreview && photoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }
    const file = event.target.files?.[0];
    setPhotoFileName(file ? file.name : "");
    setPhotoPreview(file ? URL.createObjectURL(file) : "");
    setPhotoFile(file || null);
  };

  const handleResumeUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setParsingResume(true);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!data.success || !data.message) {
        toast.error(data.message || "Failed to parse resume.");
        return;
      }

      const parsed = parseResumeForProfile(data.message as string);
      applyParsedProfile(parsed);
      await persistProfile(parsed);
      toast.success("Resume parsed and profile updated.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to parse and save resume.");
    } finally {
      setParsingResume(false);
      event.target.value = "";
    }
  };

  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-500">
          Keep your personal information up to date.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-3">
          <h3 className="text-xl font-semibold text-slate-900">
            Upload resume to auto-fill
          </h3>
          <p className="text-sm text-slate-500">
            Upload your resume (PDF, DOC, DOCX). We will extract your details, fill the form, and save to your profile.
          </p>
          <Input
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleResumeUpload}
            disabled={parsingResume || saving}
          />
          <p className="text-xs text-slate-500">
            {parsingResume
              ? "Parsing your resume and updating your profile..."
              : "Max file size depends on your Supabase storage limits."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-semibold">OR</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {photoPreview ? (
              <AvatarImage src={photoPreview} alt={displayName || "Profile"} />
            ) : null}
            <AvatarFallback className="bg-slate-900 text-white text-lg">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div>
            <p className="text-sm text-slate-500">Signed in as</p>
            <p className="text-base font-medium text-slate-900">
              {displayName}
            </p>
          </div>
        </div>

        <form onSubmit={handleProfileSave} className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-600">
                Full name
              </label>
              <Input
                placeholder="Add your name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-600">
                Profile photo
              </label>
              <Input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
              />
              {photoFileName && (
                <p className="text-xs text-slate-500">{photoFileName}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">
                Email
              </label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                disabled
                readOnly
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">
                Phone number
              </label>
              <Input
                type="tel"
                placeholder="+1 555 555 5555"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-600">
                Professional headline
              </label>
              <Input
                placeholder="e.g. Frontend Engineer @ SynCV"
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">
                Behance
              </label>
              <Input
                placeholder="https://www.behance.net/username"
                value={behance}
                onChange={(event) => setBehance(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">
                GitHub
              </label>
              <Input
                placeholder="https://github.com/username"
                value={github}
                onChange={(event) => setGithub(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">
                LinkedIn
              </label>
              <Input
                placeholder="https://www.linkedin.com/in/username"
                value={linkedin}
                onChange={(event) => setLinkedin(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">
                Portfolio
              </label>
              <Input
                placeholder="https://portfolio.com"
                value={portfolio}
                onChange={(event) => setPortfolio(event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-600">
                Other link
              </label>
              <Input
                placeholder="Any additional link"
                value={otherLink}
                onChange={(event) => setOtherLink(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">
                City
              </label>
              <Input
                placeholder="e.g. San Francisco"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">
                Country
              </label>
              <Input
                placeholder="e.g. United States"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">
                Experience (years)
              </label>
              <Input
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g. 5"
                value={experienceYears}
                onChange={(event) => setExperienceYears(event.target.value)}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="rounded-full"
            disabled={saving || parsingResume}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </div>
    </section>
  );
};

