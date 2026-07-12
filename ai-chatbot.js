/**
 * Dify 专属智能客服组件 (流式响应版)
 * 
 * 使用方式：
 * 1. 引入本脚本即可自动初始化悬浮球和聊天窗口。
 * 2. 外部可通过调用 window.openChatWithProduct('商品名称') 开启特定商品咨询。
 */

(function () {
    // --- Dify 接口配置 ---
    const DIFY_CONFIG = {
        token: 'app-IWD9IuSPWRu7vUNAQhlFJycJ', // 您的 API Key
        baseUrl: 'http://45.77.179.85/v1',     // 接口 Base URL
        user: 'user_' + Math.random().toString(36).substring(2, 10), // 生成唯一终端用户标识
        conversationId: ''                    // 保存会话ID，维持上下文连续性
    };

    // --- 初始化样式与 DOM ---
    function init() {
        // 1. 注入 CSS 动画与滚动条样式
        const style = document.createElement('style');
        style.innerHTML = `
            .dify-chat-messages::-webkit-scrollbar {
                width: 4px;
            }
            .dify-chat-messages::-webkit-scrollbar-thumb {
                background-color: #cbd5e1;
                border-radius: 2px;
            }
            @keyframes dify-ping {
                0% { transform: scale(1); opacity: 1; }
                70%, 100% { transform: scale(2); opacity: 0; }
            }
            .dify-animate-ping {
                animation: dify-ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
            }
        `;
        document.head.appendChild(style);

        // 2. 创建并注入 HTML DOM 结构
        const container = document.createElement('div');
        container.id = 'dify-chatbot-wrapper';
        container.innerHTML = `
            <!-- 右下角悬浮客服按钮 -->
            <div id="dify-chat-bubble" class="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg cursor-pointer hover:bg-blue-700 transition duration-300 z-50">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            </div>

            <!-- 客服对话窗口 -->
            <div id="dify-chat-window" class="hidden fixed bottom-6 right-6 w-80 sm:w-96 h-[500px] bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden border border-gray-100 z-50">
                <!-- 窗口头部 -->
                <div class="bg-blue-600 text-white p-4 flex justify-between items-center">
                    <div class="flex items-center space-x-2">
                        <div class="w-2.5 h-2.5 bg-green-400 rounded-full dify-animate-ping"></div>
                        <span class="font-medium text-sm">专属智能客服</span>
                    </div>
                    <button id="dify-chat-close" class="text-white hover:text-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <!-- 聊天内容展示区 -->
                <div id="dify-chat-messages" class="dify-chat-messages flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50 text-sm">
                    <!-- 初始欢迎语 -->
                    <div class="flex items-start">
                        <div class="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg max-w-[80%] rounded-tl-none">
                            您好！我是您的专属智能客服。请问有什么我可以帮您的？
                        </div>
                    </div>
                </div>

                <!-- 输入框区域 -->
                <div class="p-3 bg-white border-t border-gray-100 flex items-center space-x-2">
                    <input type="text" id="dify-user-input" placeholder="输入您的问题..." class="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <button id="dify-chat-send" class="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition">发送</button>
                </div>
            </div>
        `;
        document.body.appendChild(container);

        // 3. 注册事件监听
        document.getElementById('dify-chat-bubble').addEventListener('click', toggleChatWindow);
        document.getElementById('dify-chat-close').addEventListener('click', toggleChatWindow);
        document.getElementById('dify-chat-send').addEventListener('click', handleUserSend);
        document.getElementById('dify-user-input').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                handleUserSend();
            }
        });
    }

    // --- 窗口显示隐藏 ---
    function toggleChatWindow() {
        const windowEl = document.getElementById('dify-chat-window');
        const bubbleEl = document.getElementById('dify-chat-bubble');
        if (windowEl.classList.contains('hidden')) {
            windowEl.classList.remove('hidden');
            bubbleEl.classList.add('hidden');
            const inputEl = document.getElementById('dify-user-input');
            if (inputEl && !inputEl.disabled) {
                inputEl.focus();
            }
        } else {
            windowEl.classList.add('hidden');
            bubbleEl.classList.remove('hidden');
        }
    }

    // --- 渲染消息气泡 ---
    function appendMessageBubble(sender, text) {
        const chatMessages = document.getElementById('dify-chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex ' + (sender === 'user' ? 'justify-end' : 'justify-start');

        const bubble = document.createElement('div');
        if (sender === 'user') {
            bubble.className = 'bg-blue-600 text-white px-3 py-2 rounded-lg max-w-[80%] rounded-tr-none break-words';
        } else {
            bubble.className = 'bg-gray-200 text-gray-700 px-3 py-2 rounded-lg max-w-[80%] rounded-tl-none break-words';
        }
        bubble.innerText = text;

        messageDiv.appendChild(bubble);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return bubble; // 返回 DOM 元素以便后续动态追加文本（流式打字机）
    }

    // --- 发送逻辑 ---
    function handleUserSend() {
        const inputEl = document.getElementById('dify-user-input');
        if (inputEl.disabled) return; // 正在生成回答时，阻止再次发送

        const text = inputEl.value.trim();
        if (!text) return;

        // 1. 渲染用户消息
        appendMessageBubble('user', text);
        inputEl.value = '';

        // 2. 调用 Dify API 获取流式回复
        requestDifyStream(text);
    }

// --- Dify 流式接口核心处理 (SSE + 超时机制) ---
    async function requestDifyStream(queryText) {
        const inputEl = document.getElementById('dify-user-input');
        const sendBtn = document.getElementById('dify-chat-send');

        // 发送期间禁用输入框与发送按钮
        if (inputEl) inputEl.disabled = true;
        if (sendBtn) sendBtn.disabled = true;

        const aiBubble = appendMessageBubble('ai', '...');
        let hasStartedResponse = false;

        // 创建 AbortController 用于实现超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort(); // 达到时间未响应，主动中断请求
        }, 15000); // 15秒超时时间

        try {
            const response = await fetch(`${DIFY_CONFIG.baseUrl}/chat-messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${DIFY_CONFIG.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: {},
                    query: queryText,
                    response_mode: 'streaming',
                    user: DIFY_CONFIG.user,
                    conversation_id: DIFY_CONFIG.conversationId || ""
                }),
                signal: controller.signal // 将中止信号绑定到 fetch
            });

            // 请求成功响应，清除超时定时器
            clearTimeout(timeoutId);

            if (!response.ok) {
                let errorMsg = `网络请求异常: ${response.status}`;
                try {
                    const errorJson = await response.json();
                    if (errorJson && errorJson.message) {
                        errorMsg = `接口报错: ${errorJson.message}`;
                    }
                } catch (_) {}
                throw new Error(errorMsg);
            }

            if (!response.body) {
                throw new Error('浏览器不支持 ReadableStream 或响应体为空');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;

                    if (trimmedLine.startsWith('data:')) {
                        const jsonStr = trimmedLine.slice(5).trim();
                        try {
                            const parsed = JSON.parse(jsonStr);

                            if (parsed.event === 'message') {
                                if (!hasStartedResponse) {
                                    aiBubble.innerText = ''; 
                                    hasStartedResponse = true;
                                }
                                aiBubble.innerText += parsed.answer;
                                const chatMessages = document.getElementById('dify-chat-messages');
                                chatMessages.scrollTop = chatMessages.scrollHeight;
                            } else if (parsed.event === 'error') {
                                if (!hasStartedResponse) {
                                    aiBubble.innerText = '';
                                    hasStartedResponse = true;
                                }
                                aiBubble.innerText = `对话异常: ${parsed.message || '服务响应错误'}`;
                            }

                            if (parsed.conversation_id && !DIFY_CONFIG.conversationId) {
                                DIFY_CONFIG.conversationId = parsed.conversation_id;
                            }
                        } catch (e) {
                            // 忽略非标准或不完整的 JSON 帧
                        }
                    }
                }

                if (done) break;
            }
        } catch (error) {
            clearTimeout(timeoutId); // 确保出错时也清除定时器
            console.error("Dify 接口调用失败:", error);
            
            if (error.name === 'AbortError') {
                aiBubble.innerText = '连接超时，服务器未在规定时间内响应，请稍后重试。';
            } else if (!hasStartedResponse) {
                aiBubble.innerText = error.message || '抱歉，智能客服服务暂时无法连接。';
            } else {
                aiBubble.innerText += '\n[连接异常中断]';
            }
        } finally {
            if (inputEl) {
                inputEl.disabled = false;
                inputEl.focus();
            }
            if (sendBtn) {
                sendBtn.disabled = false;
            }
        }
    }

    // --- 外部接入网关 (供主站页面商品按钮调用) ---
    window.openChatWithProduct = function (productName) {
        const inputEl = document.getElementById('dify-user-input');
        // 如果正在接收消息，不响应外部调用，防止时序错乱
        if (inputEl && inputEl.disabled) {
            return;
        }

        const windowEl = document.getElementById('dify-chat-window');
        if (windowEl.classList.contains('hidden')) {
            toggleChatWindow();
        }
        
        const text = `我想咨询关于“${productName}”`;
        appendMessageBubble('user', text);
        requestDifyStream(text);
    };

    // --- 挂载初始化 ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();