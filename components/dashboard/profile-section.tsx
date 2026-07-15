"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { AlertCircleIcon, BriefcaseBusiness, Building2, CalendarPlusIcon, FileText, GithubIcon, Globe, Image as ImageIcon, LinkedinIcon, Loader2, Mail, MapIcon, PhoneCall, SaveIcon, UploadCloud, User2, User2Icon, UserCircle2Icon } from "lucide-react";
import { ChangeEvent, ComponentType, FormEvent, ReactNode, useEffect, useState } from "react";
import { toast } from "react-toastify";

const FieldLabel = ({
  icon: Icon,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) => (
  <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
    <Icon className="h-3.5 w-3.5" /> {children}
  </label>
);

const GroupHeading = ({ children }: { children: ReactNode }) => (
  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
    {children}
  </p>
);

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
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
          <UserCircle2Icon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
          <p className="text-sm text-slate-500">Keep your personal information up to date.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900/5 text-slate-700">
            <FileText className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold text-slate-900">Upload resume to auto-fill</h3>
        </div>
        <p className="mb-3 text-sm text-slate-500">
          Upload your resume (PDF, DOC, DOCX). We&apos;ll extract your details, fill the form,
          and save it to your profile.
        </p>
        <label
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 py-7 text-center transition hover:border-slate-300 hover:bg-slate-50",
            (parsingResume || saving) && "pointer-events-none opacity-60"
          )}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
            {parsingResume ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <UploadCloud className="h-5 w-5" />
            )}
          </span>
          <span className="text-sm font-medium text-slate-700">
            {parsingResume ? "Parsing your resume…" : "Click to upload your resume"}
          </span>
          <span className="text-xs text-slate-400">PDF, DOC, or DOCX</span>
          <input
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleResumeUpload}
            disabled={parsingResume || saving}
          />
        </label>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
          <AlertCircleIcon className="h-3.5 w-3.5 shrink-0" />
          <span>Max file size depends on your Supabase storage limits.</span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">Or enter manually</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
          <label className="group relative cursor-pointer">
            <Avatar className="h-16 w-16">
              {photoPreview ? (
                <AvatarImage src={photoPreview} alt={displayName || "Profile"} />
              ) : null}
              <AvatarFallback className="bg-slate-900 text-lg text-white">
                <User2Icon />
              </AvatarFallback>
            </Avatar>
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition group-hover:opacity-100">
              <ImageIcon className="h-5 w-5 text-white" />
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </label>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">Signed in as</p>
            <p className="truncate text-base font-semibold text-slate-900">{displayName}</p>
            <label className="mt-0.5 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900">
              <ImageIcon className="h-3.5 w-3.5" />
              {photoFileName || "Change photo"}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
          </div>
        </div>

        <form onSubmit={handleProfileSave} className="mt-5 space-y-6">
          <div>
            <GroupHeading>Basic information</GroupHeading>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <FieldLabel icon={User2}>Full name</FieldLabel>
                <Input
                  className="rounded-md"
                  placeholder="Add your name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <FieldLabel icon={BriefcaseBusiness}>Professional headline</FieldLabel>
                <Input
                  className="rounded-md"
                  placeholder="e.g. Frontend Engineer @ SyncV"
                  value={headline}
                  onChange={(event) => setHeadline(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <GroupHeading>Contact &amp; location</GroupHeading>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel icon={Mail}>Email</FieldLabel>
                <Input
                  className="rounded-md bg-slate-50"
                  type="email"
                  value={email}
                  disabled
                  readOnly
                />
              </div>
              <div>
                <FieldLabel icon={PhoneCall}>Phone number</FieldLabel>
                <Input
                  className="rounded-md"
                  type="tel"
                  placeholder="+1 555 555 5555"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <div>
                <FieldLabel icon={Building2}>City</FieldLabel>
                <Input
                  className="rounded-md"
                  placeholder="e.g. San Francisco"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />
              </div>
              <div>
                <FieldLabel icon={MapIcon}>Country</FieldLabel>
                <Input
                  className="rounded-md"
                  placeholder="e.g. United States"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                />
              </div>
              <div>
                <FieldLabel icon={CalendarPlusIcon}>Experience (years)</FieldLabel>
                <Input
                  className="rounded-md"
                  type="text"
                  placeholder="e.g. 5"
                  value={experienceYears}
                  onChange={(event) => setExperienceYears(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <GroupHeading>Professional links</GroupHeading>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel icon={LinkedinIcon}>LinkedIn</FieldLabel>
                <Input
                  className="rounded-md"
                  placeholder="https://www.linkedin.com/in/username"
                  value={linkedin}
                  onChange={(event) => setLinkedin(event.target.value)}
                />
              </div>
              <div>
                <FieldLabel icon={GithubIcon}>GitHub</FieldLabel>
                <Input
                  className="rounded-md"
                  placeholder="https://github.com/username"
                  value={github}
                  onChange={(event) => setGithub(event.target.value)}
                />
              </div>
              <div>
                <FieldLabel icon={Globe}>Portfolio</FieldLabel>
                <Input
                  className="rounded-md"
                  placeholder="https://portfolio.com"
                  value={portfolio}
                  onChange={(event) => setPortfolio(event.target.value)}
                />
              </div>
              <div>
                <FieldLabel icon={Globe}>Behance</FieldLabel>
                <Input
                  className="rounded-md"
                  placeholder="https://www.behance.net/username"
                  value={behance}
                  onChange={(event) => setBehance(event.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <FieldLabel icon={Globe}>Other link</FieldLabel>
                <Input
                  className="rounded-md"
                  placeholder="Any additional link"
                  value={otherLink}
                  onChange={(event) => setOtherLink(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <Button type="submit" className="rounded-md" disabled={saving || parsingResume}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <SaveIcon className="mr-2 h-4 w-4" />
              )}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
};
