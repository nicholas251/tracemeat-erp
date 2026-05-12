import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle } from "lucide-react";

export default function ProfileCreation() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [selectedProfiles, setSelectedProfiles] = useState([]);

  const { data: workProfiles = [] } = useQuery({
    queryKey: ["workProfiles"],
    queryFn: () => base44.entities.WorkProfile.list(),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await base44.functions.invoke('signupUser', { 
        fullName, 
        email,
        requestedProfileIds: selectedProfiles,
        requestedProfileNames: workProfiles.filter(p => selectedProfiles.includes(p.id)).map(p => p.name)
      });
      base44.auth.redirectToLogin();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to create profile");
    } finally {
      setLoading(false);
    }
  };

  const toggleProfile = (id) => {
    setSelectedProfiles(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Your Profile</CardTitle>
          <CardDescription>Join the team and get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex gap-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Request Work Profiles (Optional)</Label>
              <p className="text-xs text-muted-foreground">Select the roles you'd like to be assigned to. An administrator will review your request.</p>
              {workProfiles.length === 0 ? (
                <p className="text-xs text-muted-foreground bg-muted/40 rounded p-2 text-center">No profiles available</p>
              ) : (
                <div className="space-y-2">
                  {workProfiles.filter(p => p.status === "active").map(profile => (
                    <div key={profile.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                      <Checkbox 
                        id={profile.id}
                        checked={selectedProfiles.includes(profile.id)}
                        onCheckedChange={() => toggleProfile(profile.id)}
                      />
                      <Label htmlFor={profile.id} className="mb-0 cursor-pointer text-sm">
                        {profile.name}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
            </form>
        </CardContent>
      </Card>
    </div>
  );
}