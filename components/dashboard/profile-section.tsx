"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { AlertCircleIcon, BriefcaseBusiness, Building2, CalendarPlusIcon, File, GithubIcon, Globe, Image as ImageIcon, LinkedinIcon, Loader2, Mail, MapIcon, PhoneCall, SaveIcon, User2, User2Icon, UserCircle2Icon } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { toast } from "react-toastify";

type ProfileSectionProps = {
  user: {
    id?: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  } | null;
};

type ParsedProfile = Partial<
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
    | "city"
    | "country"
    | "experienceYears",
    string
  >
>;

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

  const displayName = fullName || user?.email || "";

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        toast.error("Failed to load profile.");
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

  const applyParsedProfile = (parsed: ParsedProfile) => {
    if (parsed.fullName) setFullName(parsed.fullName);
    if (parsed.phone) setPhone(parsed.phone);
    if (parsed.headline) setHeadline(parsed.headline);
    if (parsed.behance) setBehance(parsed.behance);
    if (parsed.github) setGithub(parsed.github);
    if (parsed.linkedin) setLinkedin(parsed.linkedin);
    if (parsed.portfolio) setPortfolio(parsed.portfolio);
    if (parsed.otherLink) setOtherLink(parsed.otherLink);
    if (parsed.city) setCity(parsed.city);
    if (parsed.country) setCountry(parsed.country);
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

      toast.success("Your profile has been updated");
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
    formData.append("extractProfile", "true");
    setParsingResume(true);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!data.success || !data.profile) {
        toast.error(data.message || "Failed to parse resume.");
        return;
      }

      const parsed = data.profile as ParsedProfile;
      applyParsedProfile(parsed);
      await persistProfile(parsed);
      // toast.success("Resume parsed and profile updated.");
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
      <div className="flex flex-col gap-2">
        <h1 className="flex gap-1 items-center text-3xl font-semibold text-slate-900"><UserCircle2Icon />Profile</h1>
        <p className="text-sm text-slate-500 font-medium">
          Keep your personal information up to date.
        </p>
      </div>

      <div className="rounded-lg shadow-xl bg-white p-6 shadow-sm">
        <div className="space-y-3">
          <h3 className="flex gap-2 items-center text-xl font-semibold text-slate-900">
            <File /> Upload resume to auto-fill
          </h3>
          <p className="text-sm text-slate-500">
            Upload your resume (PDF, DOC, DOCX). We will extract your details, fill the form, and save to your profile.
          </p>
          <Input
            className="rounded-md"
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleResumeUpload}
            disabled={parsingResume || saving}
          />
          <div className="text-xs text-slate-500 font-medium">
            {parsingResume
              ?
              <div className="flex items-center">
                <Loader2 className="h-4" />
                <span>Parsing your resume and updating your profile</span>
              </div>
              :
              <div className="flex items-center">
                <AlertCircleIcon className="h-4" />
                <span>Max file size depends on your Supabase storage limits.</span>
              </div>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-semibold">OR</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="rounded-lg shadow-xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {photoPreview ? (
              <AvatarImage src={photoPreview} alt={displayName || "Profile"} />
            ) : null}
            <AvatarFallback className="bg-slate-900 text-white text-lg">
              <User2Icon />
            </AvatarFallback>
          </Avatar>

          <div>
            <p className="text-xs text-slate-500 font-medium">Signed in as</p>
            <p className="text-base font-medium text-slate-900">
              {displayName}
            </p>
          </div>
        </div>

        <form onSubmit={handleProfileSave} className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <User2 className="h-4" /> Full Name
              </label>
              <Input
                className="rounded-lg"
                placeholder="Add your name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <ImageIcon className="h-4" />
                Profile Photo
              </label>
              <Input
                className="rounded-lg"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
              />
              {photoFileName && (
                <p className="text-xs text-slate-500">{photoFileName}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <Mail className="h-4" />
                Email
              </label>
              <Input
                className="rounded-lg"
                type="email"
                placeholder="you@example.com"
                value={email}
                disabled
                readOnly
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <PhoneCall className="h-4" />
                Phone Number
              </label>
              <Input
                className="rounded-lg"
                type="tel"
                placeholder="+1 555 555 5555"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <BriefcaseBusiness className="h-4" />
                Professional Headline
              </label>
              <Input
                className="rounded-lg"
                placeholder="e.g. Frontend Engineer @ SynCV"
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <Globe className="h-4" />
                Behance
              </label>
              <Input
                className="rounded-lg"
                placeholder="https://www.behance.net/username"
                value={behance}
                onChange={(event) => setBehance(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <GithubIcon className="h-4" />
                GitHub
              </label>
              <Input
                className="rounded-lg"
                placeholder="https://github.com/username"
                value={github}
                onChange={(event) => setGithub(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <LinkedinIcon className="h-4" />
                LinkedIn
              </label>
              <Input
                className="rounded-lg"
                placeholder="https://www.linkedin.com/in/username"
                value={linkedin}
                onChange={(event) => setLinkedin(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <Globe className="h-4" />
                Portfolio
              </label>
              <Input
                className="rounded-lg"
                placeholder="https://portfolio.com"
                value={portfolio}
                onChange={(event) => setPortfolio(event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <Globe className="h-4" />
                Other link
              </label>
              <Input
                className="rounded-lg"
                placeholder="Any additional link"
                value={otherLink}
                onChange={(event) => setOtherLink(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <Building2 className="h-4" />
                City
              </label>
              <Input
                className="rounded-lg"
                placeholder="e.g. San Francisco"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <MapIcon className="h-4" />
                Country
              </label>
              <Input
                className="rounded-lg"
                placeholder="e.g. United States"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <CalendarPlusIcon className="h-4" />
                Experience (years)
              </label>
              <Input
                className="rounded-lg"
                type="text"
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
            className="rounded-lg"
            disabled={saving || parsingResume}
          >
            <SaveIcon />
            {saving ? "Saving" : "Save Changes"}
          </Button>
        </form>
      </div>
    </section>
  );
};
