const renderChatInterface = () => (
    <div className="w-[400px] flex flex-col border-r border-gray-200 bg-white shadow-sm z-10 h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <span className="text-xl">🤖</span>
            </div>
            <div>
                <h1 className="font-semibold text-gray-900">Requisor Agent</h1>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs text-gray-500 font-medium">Online • Social Strategist</span>
                </div>
            </div>
            <div className="ml-auto">
                <button
                    onClick={handleClearChat}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-full hover:bg-red-50"
                    title="Clear Chat History"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-gray-200">
            {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-0 animate-fade-in" style={{ animation: 'fadeIn 0.5s forwards' }}>
                    <div className="w-20 h-20 bg-gradient-to-tr from-blue-100 to-purple-100 rounded-full flex items-center justify-center mb-6 text-4xl shadow-sm">
                        👋
                    </div>
                    <h3 className="text-2xl font-medium text-gray-800 mb-2">Hello, Creator</h3>
                    <p className="text-gray-500 max-w-md leading-relaxed">
                        I can help you draft posts, refine content, or schedule updates.
                        Try asking: <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => setChatInput("Draft a LinkedIn post about AI trends")}>"Draft a LinkedIn post about AI trends"</span>
                    </p>
                </div>
            )}

            {messages.map((msg, idx) => (
                <div key={idx} className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`${msg.draft ? "w-full" : "max-w-[85%]"} flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs shadow-sm ${msg.role === "user"
                            ? "bg-gray-800 text-white"
                            : "bg-gradient-to-tr from-blue-500 to-purple-500 text-white"
                            }`}>
                            {msg.role === "user" ? "U" : "AI"}
                        </div>

                        {/* Message Bubble */}
                        <div className={`flex flex-col gap-2 w-full ${msg.role === "user" ? "items-end" : "items-start"}`}>
                            {/* Text Content */}
                            {msg.content && !msg.draft && (
                                <div className={`px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${msg.role === "user"
                                    ? "bg-gray-100 text-gray-800 rounded-tr-sm"
                                    : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm"
                                    }`}>
                                    <div className="whitespace-pre-wrap">
                                        {msg.role === "assistant" && msg.animate ? (
                                            <TypeAnimation
                                                sequence={[msg.content]}
                                                wrapper="span"
                                                speed={80}
                                                cursor={false}
                                                style={{ display: 'inline-block' }}
                                            />
                                        ) : (
                                            msg.content
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Visualize Draft Button */}
                            {msg.role === "assistant" && !msg.draft && !msg.isLoading && msg.content && isLikelyPost(msg.content) && (
                                <div className="mt-2">
                                    <button
                                        onClick={() => {
                                            const extracted = extractPostContent(msg.content);
                                            setSelectedDraft({
                                                content: extracted,
                                                topic: topic || "Draft Content"
                                            });
                                            setActiveCanvasTab("editor");
                                        }}
                                        className="text-xs flex items-center gap-1.5 text-cyan-600 hover:text-cyan-700 font-medium bg-cyan-50 px-3 py-1.5 rounded-lg transition-all border border-cyan-100 hover:border-cyan-200 hover:bg-cyan-100"
                                    >
                                        <Eye size={12} />
                                        Open in Editor
                                    </button>
                                </div>
                            )}

                            {/* Loading State */}
                            {msg.isLoading && (
                                <div className="flex items-center gap-2 text-gray-500 text-sm animate-pulse ml-2">
                                    <span>Working on it...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}
            <div ref={(el) => el?.scrollIntoView({ behavior: "smooth" })} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-100 bg-white">
            <div className="relative bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50/50 transition-all shadow-inner">
                <div className="flex items-end p-2">
                    <div className="flex-shrink-0 pb-2 pl-2">
                        <input
                            type="file"
                            id="chat-file-upload"
                            className="hidden"
                            onChange={handleChatFileSelect}
                            accept="image/*,video/*"
                        />
                        <button
                            onClick={() => document.getElementById('chat-file-upload')?.click()}
                            className={`p-2.5 rounded-full transition-all ${chatFile ? 'bg-blue-100 text-blue-600 rotate-12' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'}`}
                            title="Upload image or video"
                        >
                            <Paperclip size={20} />
                        </button>
                    </div>

                    <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSubmit()}
                        placeholder="Ask to schedule a post..."
                        className="flex-1 bg-transparent border-none focus:ring-0 resize-none min-h-[60px] max-h-[200px] py-3.5 px-3 text-[15px] text-gray-800 placeholder-gray-400 leading-relaxed"
                        disabled={chatLoading}
                    />

                    <div className="pb-2 pr-2">
                        <button
                            onClick={handleChatSubmit}
                            disabled={chatLoading || (!chatInput.trim() && !chatFile)}
                            className="bg-gray-900 text-white p-3 rounded-xl hover:bg-black hover:shadow-lg hover:scale-105 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
                {chatFile && (
                    <div className="mx-4 mb-3 bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-3 animate-slide-up">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                            {chatFile.type.startsWith('image') ? '🖼️' : '📹'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">{chatFile.name}</p>
                            <p className="text-xs text-gray-400">{(chatFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button onClick={() => setChatFile(null)} className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    </div>
);
