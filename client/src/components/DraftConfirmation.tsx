import React, { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Send, Edit2, CheckCircle2 } from "lucide-react";

interface DraftConfirmationProps {
    initialContent: string;
    topic: string;
    onConfirm: (content: string, platforms: string[]) => void;
    onCancel: () => void;
}

export function DraftConfirmation({ initialContent, topic, onConfirm, onCancel }: DraftConfirmationProps) {
    const [content, setContent] = useState(initialContent);
    const [platforms, setPlatforms] = useState({
        facebook: false,
        twitter: false,
        linkedin: false,
    });

    const handlePlatformChange = (platform: keyof typeof platforms) => {
        setPlatforms((prev) => ({ ...prev, [platform]: !prev[platform] }));
    };

    const handleConfirm = () => {
        const selectedPlatforms = Object.entries(platforms)
            .filter(([_, selected]) => selected)
            .map(([platform]) => platform);

        if (selectedPlatforms.length === 0) {
            alert("Please select at least one platform.");
            return;
        }

        onConfirm(content, selectedPlatforms);
    };

    return (
        <Card className="w-full max-w-2xl mx-auto mt-4 border-cyan-500/30 bg-black/40 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.15)] text-cyan-50">
            <CardHeader className="border-b border-cyan-500/20 pb-3">
                <CardTitle className="flex items-center gap-2 text-xl font-light tracking-wider text-cyan-400">
                    <Edit2 className="w-5 h-5" />
                    REVIEW DRAFT
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="draft-content" className="text-xs uppercase tracking-widest text-cyan-300/70">
                        Generated Content
                    </Label>
                    <Textarea
                        id="draft-content"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="min-h-[150px] bg-cyan-950/20 border-cyan-500/30 focus:border-cyan-400 text-cyan-50 placeholder:text-cyan-500/50 resize-y"
                    />
                </div>

                <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-widest text-cyan-300/70">
                        Select Platforms
                    </Label>
                    <div className="flex gap-6">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="facebook"
                                checked={platforms.facebook}
                                onCheckedChange={() => handlePlatformChange("facebook")}
                                className="border-cyan-500/50 data-[state=checked]:bg-cyan-500 data-[state=checked]:text-black"
                            />
                            <Label htmlFor="facebook" className="cursor-pointer hover:text-cyan-300 transition-colors">Facebook</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="twitter"
                                checked={platforms.twitter}
                                onCheckedChange={() => handlePlatformChange("twitter")}
                                className="border-cyan-500/50 data-[state=checked]:bg-cyan-500 data-[state=checked]:text-black"
                            />
                            <Label htmlFor="twitter" className="cursor-pointer hover:text-cyan-300 transition-colors">Twitter</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="linkedin"
                                checked={platforms.linkedin}
                                onCheckedChange={() => handlePlatformChange("linkedin")}
                                className="border-cyan-500/50 data-[state=checked]:bg-cyan-500 data-[state=checked]:text-black"
                            />
                            <Label htmlFor="linkedin" className="cursor-pointer hover:text-cyan-300 transition-colors">LinkedIn</Label>
                        </div>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-3 pt-2 pb-6 border-t border-cyan-500/20">
                <Button
                    variant="ghost"
                    onClick={onCancel}
                    className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30"
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleConfirm}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_10px_rgba(8,145,178,0.5)] transition-all duration-300"
                >
                    <Send className="w-4 h-4 mr-2" />
                    Publish Now
                </Button>
            </CardFooter>
        </Card>
    );
}
