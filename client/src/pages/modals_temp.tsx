const renderModals = () => (
    <>
        {/* Platform Selection Modal */}
        {showPlatformSelect && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl transform transition-all scale-100">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Select Platforms</h3>
                    <div className="space-y-3 mb-6">
                        {["Twitter", "Facebook", "LinkedIn", "Mastodon"].map((p) => (
                            <label key={p} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${p === "Twitter" ? "bg-blue-100 text-blue-600" :
                                        p === "Facebook" ? "bg-indigo-100 text-indigo-600" :
                                            p === "LinkedIn" ? "bg-sky-100 text-sky-700" :
                                                "bg-purple-100 text-purple-600"
                                        } `}>
                                        {p === "Twitter" && <FaTwitter size={16} />}
                                        {p === "Facebook" && <FaFacebook size={16} />}
                                        {p === "LinkedIn" && <FaLinkedin size={16} />}
                                        {p === "Mastodon" && <span className="text-xs font-bold">M</span>}
                                    </div>
                                    <span className="font-medium text-gray-700">{p}</span>
                                </div>
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    checked={selectedPlatforms.includes(p)}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedPlatforms(prev => [...prev, p]);
                                        } else {
                                            setSelectedPlatforms(prev => prev.filter(item => item !== p));
                                        }
                                    }}
                                />
                            </label>
                        ))}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowPlatformSelect(false)}
                            className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                setShowPlatformSelect(false);
                                publishContentToAll(pendingContent, selectedPlatforms);
                            }}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                            disabled={selectedPlatforms.length === 0}
                        >
                            Publish
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Custom Success Popup */}
        {showSuccessPopup && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
                    <div className="text-center">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Post Published! 🎉
                        </h3>
                        <p className="text-gray-600 mb-6">
                            Your content has been successfully shared on {platform}.
                        </p>
                        <div className="flex gap-3">
                            <Button
                                onClick={() => {
                                    if (successPostUrl) {
                                        window.open(successPostUrl, "_blank");
                                    }
                                    setShowSuccessPopup(false);
                                }}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View Post
                            </Button>
                            <Button
                                onClick={() => setShowSuccessPopup(false)}
                                variant="outline"
                                className="flex-1"
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Edit Post Modal */}
        {editingPost && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                    <h3 className="text-lg font-semibold mb-4">Edit Scheduled Post</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
                            <input
                                type="text"
                                value={scheduleTopicOverride || editingPost.topic}
                                onChange={(e) => setScheduleTopicOverride(e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
                            <input
                                type="text"
                                value={scheduleToneOverride || editingPost.tone}
                                onChange={(e) => setScheduleToneOverride(e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled Time</label>
                            <input
                                type="datetime-local"
                                value={(() => {
                                    const d = new Date(editingPost.scheduledTime);
                                    return !isNaN(d.getTime()) ? format(d, "yyyy-MM-dd'T'HH:mm") : "";
                                })()}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        const d = new Date(e.target.value);
                                        if (!isNaN(d.getTime())) {
                                            setEditingPost({
                                                ...editingPost,
                                                scheduledTime: d.toISOString(),
                                            });
                                        }
                                    }
                                }}
                                className="w-full border border-gray-300 rounded-md px-3 py-2"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={async () => {
                                try {
                                    await axios.put(
                                        `${API_BASE}/schedule/${editingPost.id}`,
                                        {
                                            topic: scheduleTopicOverride || editingPost.topic,
                                            tone: scheduleToneOverride || editingPost.tone,
                                            scheduledTime: editingPost.scheduledTime,
                                        },
                                        { withCredentials: true },
                                    );
                                    setEditingPost(null);
                                    setScheduleTopicOverride("");
                                    setScheduleToneOverride("");
                                    loadScheduledPosts();
                                } catch (error) {
                                    console.error("Failed to update post:", error);
                                    alert("Failed to update post. Please try again.");
                                }
                            }}
                            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
                        >
                            Update Post
                        </button>
                        <button
                            onClick={() => {
                                setEditingPost(null);
                                setScheduleTopicOverride("");
                                setScheduleToneOverride("");
                            }}
                            className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}
    </>
);
