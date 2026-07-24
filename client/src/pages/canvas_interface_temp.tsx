const renderCanvas = () => (
    <div className="flex-1 flex flex-col bg-gray-50/50 relative h-full">
        {/* Header & Tabs */}
        <div className="px-8 py-6 flex items-center justify-between bg-white border-b border-gray-200 sticky top-0 z-10">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Canvas</h2>
                <p className="text-gray-500 text-sm mt-1">Create, schedule, and manage content.</p>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                <button
                    onClick={() => setActiveCanvasTab("editor")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeCanvasTab === "editor" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}
                >
                    <PenTool size={16} /> Editor
                </button>
                <button
                    onClick={() => setActiveCanvasTab("calendar")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeCanvasTab === "calendar" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}
                >
                    <CalendarIcon size={16} /> Calendar
                </button>
                <button
                    onClick={() => setActiveCanvasTab("accounts")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeCanvasTab === "accounts" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}
                >
                    <Settings size={16} /> Accounts
                </button>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 overflow-y-auto">
            {activeCanvasTab === "editor" && (
                <div className="h-full flex flex-col">
                    {selectedDraft ? (
                        <InlineDraftCard
                            initialContent={selectedDraft.content}
                            topic={selectedDraft.topic}
                            connectedAccounts={connectedAccounts}
                            isPublished={false}
                            onConfirm={(content, platforms, mediaFiles) => publishContentToAll(content, platforms, mediaFiles)}
                            onSchedule={handleSchedule}
                            onEdit={(newContent) => {
                                setSelectedDraft({ ...selectedDraft, content: newContent });
                            }}
                            onCancel={() => setSelectedDraft(null)}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-300">
                                <PenTool size={32} />
                            </div>
                            <h3 className="text-lg font-medium text-gray-600">No active draft</h3>
                            <p className="text-sm">Select a draft from chat or create a new one</p>
                            <button
                                onClick={() => { setSelectedDraft({ content: "", topic: "New Draft" }); }}
                                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                Create New Draft
                            </button>
                        </div>
                    )}
                </div>
            )}

            {activeCanvasTab === "calendar" && (
                <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm min-h-full">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-medium text-gray-900">Content Calendar</h3>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            {["Calendar", "Upcoming Posts", "History"].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === tab
                                        ? "bg-white shadow-sm text-gray-900"
                                        : "text-gray-500 hover:text-gray-700"
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>

                    {activeTab === "Calendar" && (
                        <SocialCalendar posts={[...scheduledPosts, ...jobHistory]} onPostUpdate={loadScheduledPosts} />
                    )}

                    {activeTab === "Upcoming Posts" && (
                        <div className="space-y-4">
                            {scheduledPosts.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No upcoming posts scheduled</p>
                            ) : (
                                scheduledPosts.map((post, idx) => (
                                    <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="font-medium text-gray-900">{post.platform}</span>
                                                <p className="text-sm text-gray-600 mt-1">{post.topic}</p>
                                                <p className="text-xs text-gray-400 mt-2">Scheduled for: {new Date(post.scheduledTime).toLocaleString()}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleDeletePost(post.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === "History" && (
                        <div className="space-y-4">
                            {jobHistory.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No history yet</p>
                            ) : (
                                jobHistory.map((post, idx) => (
                                    <div key={idx} className="border border-gray-200 rounded-lg p-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="font-medium text-gray-900">{post.platform}</span>
                                                <span className={`ml-2 text-xs px-2 py-0.5 rounded ${post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{post.status}</span>
                                                <p className="text-sm text-gray-600 mt-1">{post.topic}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeCanvasTab === "accounts" && (
                <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm max-w-3xl mx-auto">
                    <h3 className="text-xl font-semibold mb-6 text-gray-900">Connected Accounts</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Twitter */}
                        <div className="border rounded-xl p-6 flex flex-col items-center gap-4 hover:border-blue-200 transition-colors">
                            <FaTwitter className={`w-8 h-8 ${connectedAccounts.twitter ? "text-blue-500" : "text-gray-400"}`} />
                            <div className="text-center">
                                <h4 className="font-medium text-gray-900">Twitter</h4>
                                <p className="text-xs text-gray-500">{connectedAccounts.twitter ? "Connected" : "Not connected"}</p>
                            </div>
                            <button
                                onClick={() => window.location.href = `${SITE_BASE}/api/twitter/login`}
                                className={`w-full py-2 rounded-lg text-sm font-medium ${connectedAccounts.twitter ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"}`}
                            >
                                {connectedAccounts.twitter ? "Reconnect" : "Connect"}
                            </button>
                        </div>

                        {/* Facebook */}
                        <div className="border rounded-xl p-6 flex flex-col items-center gap-4 hover:border-blue-200 transition-colors">
                            <FaFacebook className={`w-8 h-8 ${connectedAccounts.facebook ? "text-blue-600" : "text-gray-400"}`} />
                            <div className="text-center">
                                <h4 className="font-medium text-gray-900">Facebook</h4>
                                <p className="text-xs text-gray-500">{connectedAccounts.facebook ? "Connected" : "Not connected"}</p>
                            </div>
                            <button
                                onClick={() => {
                                    const returnUrl = encodeURIComponent(window.location.pathname);
                                    window.location.href = `${SITE_BASE}/api/auth/facebook?returnTo=${returnUrl}`;
                                }}
                                className={`w-full py-2 rounded-lg text-sm font-medium ${connectedAccounts.facebook ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                            >
                                {connectedAccounts.facebook ? "Reconnect" : "Connect"}
                            </button>
                        </div>

                        {/* LinkedIn */}
                        <div className="border rounded-xl p-6 flex flex-col items-center gap-4 hover:border-blue-200 transition-colors">
                            <FaLinkedin className={`w-8 h-8 ${connectedAccounts.linkedin ? "text-blue-700" : "text-gray-400"}`} />
                            <div className="text-center">
                                <h4 className="font-medium text-gray-900">LinkedIn</h4>
                                <p className="text-xs text-gray-500">{connectedAccounts.linkedin ? "Connected" : "Not connected"}</p>
                            </div>
                            <button
                                onClick={() => {
                                    const returnUrl = encodeURIComponent(window.location.pathname);
                                    window.location.href = `${SITE_BASE}/api/auth/linkedin?returnTo=${returnUrl}`;
                                }}
                                className={`w-full py-2 rounded-lg text-sm font-medium ${connectedAccounts.linkedin ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-blue-700 text-white hover:bg-blue-800"}`}
                            >
                                {connectedAccounts.linkedin ? "Reconnect" : "Connect"}
                            </button>
                        </div>

                        {/* Mastodon */}
                        <div className="border rounded-xl p-6 flex flex-col items-center gap-4 hover:border-purple-200 transition-colors">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${connectedAccounts.mastodon ? "bg-indigo-600" : "bg-gray-400"}`}>M</div>
                            <div className="text-center">
                                <h4 className="font-medium text-gray-900">Mastodon</h4>
                                <p className="text-xs text-gray-500">{connectedAccounts.mastodon ? "Connected" : "Not connected"}</p>
                            </div>
                            <button
                                onClick={() => {
                                    const instance = window.prompt("Enter your Mastodon server (e.g. mastodon.social):", "mastodon.social");
                                    if (instance?.trim()) window.location.href = `${SITE_BASE}/api/social/mastodon/login?instance=${encodeURIComponent(instance.trim())}`;
                                }}
                                className={`w-full py-2 rounded-lg text-sm font-medium ${connectedAccounts.mastodon ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}
                            >
                                {connectedAccounts.mastodon ? "Reconnect" : "Connect"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
);
