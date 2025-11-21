"use client";
import { useState } from "react";

// Типы данных
type MessageType = 'text' | 'image' | 'video' | 'file' | 'poll' | 'buttons';

type ButtonAction = 'reply' | 'url' | 'callback' | 'next_message';

type InlineButton = {
    text: string;
    action: ButtonAction;
    value: string; // reply text, url, callback data, or message id
};

type Message = {
    id: string;
    type: MessageType;
    content: string;
    media?: {
        data: string;
        name: string;
        type: string;
    };
    caption?: string;
    poll?: {
        question: string;
        options: string[];
        is_anonymous: boolean;
        allows_multiple_answers: boolean;
    };
    buttons?: InlineButton[];
    buttonText?: string; // Custom text for buttons message
    replyTo?: string; // id of message being replied to
};

type ChatPreview = {
    messages: Message[];
    simulatedResponses: Message[];
};

export default function Home() {
    // Начальные сообщения
    const initialMessages: Message[] = [
        {
            id: '1',
            type: 'text',
            content: 'Привет! Добро пожаловать в наш чат.'
        }
    ];

    // Состояние сообщений
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
    const [chatPreview, setChatPreview] = useState<ChatPreview>({ messages: initialMessages, simulatedResponses: [] });

    // Состояние для нового сообщения
    const [newMessageType, setNewMessageType] = useState<MessageType>('text');
    const [newMessageContent, setNewMessageContent] = useState('');
    const [newMessageMedia, setNewMessageMedia] = useState<File | null>(null);
    const [newMessageMediaData, setNewMessageMediaData] = useState<string | null>(null);
    const [newMessageCaption, setNewMessageCaption] = useState('');
    const [newMessagePoll, setNewMessagePoll] = useState({
        question: '',
        options: ['', ''],
        is_anonymous: true,
        allows_multiple_answers: false
    });
    const [newMessageButtons, setNewMessageButtons] = useState<InlineButton[]>([]);
    const [newMessageButtonText, setNewMessageButtonText] = useState('');
    const [replyTo, setReplyTo] = useState<string | null>(null);

    // Состояние для отправки
    const [sending, setSending] = useState(false);

    // Состояние для мобильной навигации
    const [activeMobileTab, setActiveMobileTab] = useState<'messages' | 'preview' | 'settings'>('preview');

    // Функция отправки всей цепочки
    const sendMessageChain = async () => {
        if (messages.length === 0) {
            alert('Нет сообщений для отправки');
            return;
        }

        setSending(true);
        try {
            const res = await fetch('/api/send/chain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages }),
            });

            const result = await res.json();

            if (!res.ok) {
                alert('❌ Ошибка при отправке: ' + (result.error || 'Неизвестная ошибка'));
            } else {
                alert('✅ ' + result.message);
            }
        } catch (err: unknown) {
            console.error(err);
            alert('❌ Ошибка при отправке: ' + String(err));
        } finally {
            setSending(false);
        }
    };

    // Обработчики файлов
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'file') => {
        const file = e.target.files?.[0] ?? null;
        setNewMessageMedia(file);
        if (!file) {
            setNewMessageMediaData(null);
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const base = result.split(",")[1];
            setNewMessageMediaData(base);
        };
        reader.readAsDataURL(file);
    };

    // Добавление нового сообщения
    const addMessage = () => {
        const newMsg: Message = {
            id: Date.now().toString(),
            type: newMessageType,
            content: newMessageContent,
            replyTo: replyTo || undefined
        };

        if (newMessageType === 'image' || newMessageType === 'video' || newMessageType === 'file') {
            if (newMessageMediaData) {
                newMsg.media = {
                    data: newMessageMediaData,
                    name: newMessageMedia?.name || '',
                    type: newMessageMedia?.type || ''
                };
                newMsg.caption = newMessageCaption;
            }
        } else if (newMessageType === 'poll') {
            newMsg.poll = newMessagePoll;
        } else if (newMessageType === 'buttons') {
            newMsg.buttons = newMessageButtons;
            newMsg.buttonText = newMessageButtonText || undefined;
        }

        const updatedMessages = [...messages, newMsg];
        setMessages(updatedMessages);
        setChatPreview({ ...chatPreview, messages: updatedMessages });

        // Сброс формы
        setNewMessageContent('');
        setNewMessageMedia(null);
        setNewMessageMediaData(null);
        setNewMessageCaption('');
        setNewMessagePoll({
            question: '',
            options: ['', ''],
            is_anonymous: true,
            allows_multiple_answers: false
        });
        setNewMessageButtons([]);
        setNewMessageButtonText('');
        setReplyTo(null);
    };

    // Выбор сообщения для редактирования
    const selectMessage = (id: string) => {
        setSelectedMessageId(id);
        const msg = messages.find(m => m.id === id);
        if (msg) {
            setNewMessageType(msg.type);
            setNewMessageContent(msg.content);
            setNewMessageCaption(msg.caption || '');
            if (msg.poll) setNewMessagePoll(msg.poll);
            if (msg.buttons) setNewMessageButtons(msg.buttons);
            if (msg.buttonText) setNewMessageButtonText(msg.buttonText);
            setReplyTo(msg.replyTo || null);
        }
    };

    // Обновление выбранного сообщения
    const updateMessage = () => {
        if (!selectedMessageId) return;

        const updatedMessages = messages.map(msg => {
            if (msg.id === selectedMessageId) {
                return {
                    ...msg,
                    type: newMessageType,
                    content: newMessageContent,
                    caption: newMessageCaption,
                    poll: newMessageType === 'poll' ? newMessagePoll : undefined,
                    buttons: newMessageType === 'buttons' ? newMessageButtons : undefined,
                    buttonText: newMessageType === 'buttons' ? (newMessageButtonText || undefined) : undefined,
                    replyTo: replyTo || undefined
                };
            }
            return msg;
        });

        setMessages(updatedMessages);
        setChatPreview({ ...chatPreview, messages: updatedMessages });
    };

    // Удаление сообщения
    const deleteMessage = (id: string) => {
        const updatedMessages = messages.filter(m => m.id !== id);
        setMessages(updatedMessages);
        setChatPreview({ ...chatPreview, messages: updatedMessages });
        if (selectedMessageId === id) {
            setSelectedMessageId(null);
        }
    };

    // Добавление кнопки
    const addButton = () => {
        setNewMessageButtons([...newMessageButtons, { text: '', action: 'reply', value: '' }]);
    };

    // Обновление кнопки
    const updateButton = (index: number, field: keyof InlineButton, value: string) => {
        const updated = [...newMessageButtons];
        updated[index] = { ...updated[index], [field]: value };
        setNewMessageButtons(updated);
    };

    // Удаление кнопки
    const removeButton = (index: number) => {
        setNewMessageButtons(newMessageButtons.filter((_, i) => i !== index));
    };

    // Обновление опций опроса
    const updatePollOption = (index: number, value: string) => {
        const updated = { ...newMessagePoll };
        updated.options[index] = value;
        setNewMessagePoll(updated);
    };

    const addPollOption = () => {
        setNewMessagePoll({
            ...newMessagePoll,
            options: [...newMessagePoll.options, '']
        });
    };

    const removePollOption = (index: number) => {
        if (newMessagePoll.options.length > 2) {
            setNewMessagePoll({
                ...newMessagePoll,
                options: newMessagePoll.options.filter((_, i) => i !== index)
            });
        }
    };

    return (
        <div className="h-screen flex flex-col bg-gray-100">
            {/* Мобильная навигация */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10 mobile-nav">
                <div className="flex">
                    <button
                        onClick={() => setActiveMobileTab('messages')}
                        className={`flex-1 py-3 px-2 text-center transition-colors ${
                            activeMobileTab === 'messages'
                                ? 'text-blue-600 bg-blue-50'
                                : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        <div className="text-lg mb-1">📝</div>
                        <div className="text-xs">Сообщения</div>
                    </button>
                    <button
                        onClick={() => setActiveMobileTab('preview')}
                        className={`flex-1 py-3 px-2 text-center transition-colors ${
                            activeMobileTab === 'preview'
                                ? 'text-blue-600 bg-blue-50'
                                : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        <div className="text-lg mb-1">👁️</div>
                        <div className="text-xs">Превью</div>
                    </button>
                    <button
                        onClick={() => setActiveMobileTab('settings')}
                        className={`flex-1 py-3 px-2 text-center transition-colors ${
                            activeMobileTab === 'settings'
                                ? 'text-blue-600 bg-blue-50'
                                : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        <div className="text-lg mb-1">⚙️</div>
                        <div className="text-xs">Настройки</div>
                    </button>
                </div>
            </div>

            {/* Десктопная версия */}
            <div className="hidden md:flex flex-1">
                {/* Левая панель - список сообщений */}
                <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800">Сообщения</h2>
                    <p className="text-sm text-gray-600">Перетащите для изменения порядка</p>
                </div>
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    {messages.map((msg, index) => (
                        <div
                            key={msg.id}
                            className={`p-3 mb-2 rounded-lg cursor-pointer transition-colors panel ${
                                selectedMessageId === msg.id
                                    ? 'bg-blue-100 border-blue-300'
                                    : 'bg-gray-50 hover:bg-gray-100'
                            } border`}
                            onClick={() => selectMessage(msg.id)}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                                    {msg.type === 'text' && '💬'}
                                    {msg.type === 'image' && '🖼️'}
                                    {msg.type === 'video' && '🎥'}
                                    {msg.type === 'file' && '📎'}
                                    {msg.type === 'poll' && '📊'}
                                    {msg.type === 'buttons' && '🔘'}
                                </span>
                                <span className="text-xs text-gray-500">#{index + 1}</span>
                            </div>
                            <div className="text-sm text-gray-800 truncate">
                                {msg.content || msg.poll?.question || 'Без текста'}
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }}
                                    className="text-red-500 hover:text-red-700 text-xs"
                                >
                                    Удалить
                                </button>
                            </div>
                        </div>
                    ))}
                    <button
                        onClick={() => setSelectedMessageId(null)}
                        className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors mb-4"
                    >
                        + Добавить сообщение
                    </button>

                    {/* Кнопка отправки всей рассылки */}
                    <button
                        onClick={sendMessageChain}
                        disabled={sending || messages.length === 0}
                        className="w-full telegram-button disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {sending ? 'Отправка...' : `Отправить рассылку (${messages.length} сообщений)`}
                    </button>
                </div>
            </div>

            {/* Центральная панель - превью чата */}
            <div className="flex-1 bg-gray-50 flex flex-col">
                <div className="p-4 border-b border-gray-200 bg-white">
                    <h2 className="text-lg font-semibold text-gray-800">Превью чата</h2>
                    <p className="text-sm text-gray-600">Как будут выглядеть сообщения</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="max-w-md mx-auto bg-white rounded-lg shadow-sm min-h-full">
                        {/* Заголовок чата */}
                        <div className="bg-blue-500 text-white p-3 rounded-t-lg">
                            <h3 className="font-semibold">AntiTrash Astana</h3>
                            <p className="text-sm opacity-90">Бот для рассылки</p>
                        </div>

                        {/* Сообщения */}
                        <div className="p-4 space-y-3 min-h-[400px]">
                            {chatPreview.messages.map((msg, index) => (
                                <div key={msg.id} className="flex justify-end message-appear">
                                    <div className="message-bubble sent">
                                        {msg.replyTo && (
                                            <div className="bg-blue-400 p-2 rounded-lg mb-2 text-sm">
                                                <div className="text-blue-100">Ответ на предыдущее</div>
                                            </div>
                                        )}
                                        {msg.type === 'text' && <div>{msg.content}</div>}
                                        {msg.type === 'image' && msg.media && (
                                            <div>
                                                <img
                                                    src={`data:${msg.media.type};base64,${msg.media.data}`}
                                                    alt={msg.media.name}
                                                    className="rounded-lg mb-2 max-w-full"
                                                />
                                                {msg.caption && <div className="text-sm">{msg.caption}</div>}
                                            </div>
                                        )}
                                        {msg.type === 'poll' && msg.poll && (
                                            <div>
                                                <div className="font-semibold mb-2">{msg.poll.question}</div>
                                                {msg.poll.options.map((opt, i) => (
                                                    <div key={i} className="text-sm mb-1">• {opt}</div>
                                                ))}
                                            </div>
                                        )}
                                        {msg.type === 'buttons' && msg.buttons && (
                                            <div>
                                                {(msg.buttonText || msg.content) && (
                                                    <div className="mb-2">{msg.buttonText || msg.content}</div>
                                                )}
                                                <div className="space-y-1">
                                                    {msg.buttons.map((btn, i) => (
                                                        <button
                                                            key={i}
                                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm transition-colors"
                                                        >
                                                            {btn.text}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Правая панель - настройки */}
            <div className="hidden md:flex w-80 bg-white border-l border-gray-200 flex-col">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800">
                        {selectedMessageId ? 'Редактировать сообщение' : 'Новое сообщение'}
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {/* Выбор типа сообщения */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Тип сообщения</label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { type: 'text' as MessageType, label: 'Текст', icon: '💬' },
                                { type: 'image' as MessageType, label: 'Фото', icon: '🖼️' },
                                { type: 'video' as MessageType, label: 'Видео', icon: '🎥' },
                                { type: 'file' as MessageType, label: 'Файл', icon: '📎' },
                                { type: 'poll' as MessageType, label: 'Опрос', icon: '📊' },
                                { type: 'buttons' as MessageType, label: 'Кнопки', icon: '🔘' }
                            ].map(({ type, label, icon }) => (
                                <button
                                    key={type}
                                    onClick={() => setNewMessageType(type)}
                                    className={`p-3 border rounded-lg text-sm transition-colors panel ${
                                        newMessageType === type
                                            ? 'bg-blue-100 border-blue-300 text-blue-700'
                                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                    }`}
                                >
                                    <div className="text-lg mb-1">{icon}</div>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Содержимое в зависимости от типа */}
                    {newMessageType === 'text' && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Текст сообщения</label>
                            <textarea
                                className="w-full telegram-input resize-none"
                                rows={4}
                                placeholder="Введите текст..."
                                value={newMessageContent}
                                onChange={(e) => setNewMessageContent(e.target.value)}
                            />
                        </div>
                    )}

                    {(newMessageType === 'image' || newMessageType === 'video' || newMessageType === 'file') && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {newMessageType === 'image' && 'Выберите изображение'}
                                {newMessageType === 'video' && 'Выберите видео'}
                                {newMessageType === 'file' && 'Выберите файл'}
                            </label>
                            <input
                                type="file"
                                accept={
                                    newMessageType === 'image' ? 'image/*' :
                                    newMessageType === 'video' ? 'video/*' : '*'
                                }
                                onChange={(e) => handleFileChange(e, newMessageType as 'image' | 'video' | 'file')}
                                className="w-full telegram-input"
                            />
                            {newMessageMediaData && (
                                <div className="mt-2">
                                    {newMessageType === 'image' && (
                                        <img
                                            src={`data:${newMessageMedia?.type};base64,${newMessageMediaData}`}
                                            alt="preview"
                                            className="w-full h-32 object-cover rounded-lg"
                                        />
                                    )}
                                    <input
                                        type="text"
                                        placeholder="Подпись (caption)"
                                        className="w-full mt-2 telegram-input text-sm"
                                        value={newMessageCaption}
                                        onChange={(e) => setNewMessageCaption(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {newMessageType === 'poll' && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Вопрос опроса</label>
                            <input
                                type="text"
                                className="w-full telegram-input mb-3"
                                placeholder="Введите вопрос..."
                                value={newMessagePoll.question}
                                onChange={(e) => setNewMessagePoll({...newMessagePoll, question: e.target.value})}
                            />

                            <label className="block text-sm font-medium text-gray-700 mb-2">Варианты ответа</label>
                            {newMessagePoll.options.map((option, index) => (
                                <div key={index} className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        className="flex-1 telegram-input text-sm"
                                        placeholder={`Вариант ${index + 1}`}
                                        value={option}
                                        onChange={(e) => updatePollOption(index, e.target.value)}
                                    />
                                    {newMessagePoll.options.length > 2 && (
                                        <button
                                            onClick={() => removePollOption(index)}
                                            className="text-red-500 hover:text-red-700 px-2"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                onClick={addPollOption}
                                className="text-blue-500 hover:text-blue-700 text-sm mb-3"
                            >
                                + Добавить вариант
                            </button>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={newMessagePoll.is_anonymous}
                                        onChange={(e) => setNewMessagePoll({...newMessagePoll, is_anonymous: e.target.checked})}
                                    />
                                    <span className="text-sm">Анонимный опрос</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={newMessagePoll.allows_multiple_answers}
                                        onChange={(e) => setNewMessagePoll({...newMessagePoll, allows_multiple_answers: e.target.checked})}
                                    />
                                    <span className="text-sm">Разрешить несколько ответов</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {newMessageType === 'buttons' && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Текст сообщения с кнопками</label>
                            <input
                                type="text"
                                className="w-full telegram-input mb-4"
                                placeholder="Введите текст, который увидят пользователи (или оставьте пустым для стандартного)"
                                value={newMessageButtonText}
                                onChange={(e) => setNewMessageButtonText(e.target.value)}
                            />

                            <label className="block text-sm font-medium text-gray-700 mb-2">Inline кнопки</label>
                            {newMessageButtons.map((button, index) => (
                                <div key={index} className="border border-gray-200 rounded-lg p-3 mb-3 panel">
                                    <input
                                        type="text"
                                        placeholder="Текст кнопки"
                                        className="w-full telegram-input mb-2 text-sm"
                                        value={button.text}
                                        onChange={(e) => updateButton(index, 'text', e.target.value)}
                                    />
                                    <select
                                        className="w-full telegram-input mb-2 text-sm"
                                        value={button.action}
                                        onChange={(e) => updateButton(index, 'action', e.target.value)}
                                    >
                                        <option value="reply">Отправить ответ</option>
                                        <option value="url">Открыть ссылку</option>
                                        <option value="callback">Callback</option>
                                        <option value="next_message">Следующее сообщение</option>
                                    </select>
                                    {button.action !== 'callback' && (
                                        <input
                                            type="text"
                                            placeholder={
                                                button.action === 'reply' ? 'Текст ответа' :
                                                button.action === 'url' ? 'URL' : 'ID сообщения'
                                            }
                                            className="w-full telegram-input text-sm"
                                            value={button.value}
                                            onChange={(e) => updateButton(index, 'value', e.target.value)}
                                        />
                                    )}
                                    {button.action === 'callback' && (
                                        <div className="text-xs text-gray-500 mt-1 p-2 bg-gray-50 rounded">
                                            Для callback кнопок значение генерируется автоматически: вопрос + текст кнопки
                                        </div>
                                    )}
                                    <button
                                        onClick={() => removeButton(index)}
                                        className="text-red-500 hover:text-red-700 text-sm mt-2"
                                    >
                                        Удалить кнопку
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={addButton}
                                className="w-full p-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors text-sm"
                            >
                                + Добавить кнопку
                            </button>
                        </div>
                    )}

                    {/* Ответ на сообщение */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Ответ на сообщение</label>
                        <select
                            className="w-full telegram-input"
                            value={replyTo || ''}
                            onChange={(e) => setReplyTo(e.target.value || null)}
                        >
                            <option value="">Не отвечать</option>
                            {messages.map((msg, index) => (
                                <option key={msg.id} value={msg.id}>
                                    #{index + 1} {msg.content.substring(0, 30)}...
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Кнопки действий */}
                    <div className="flex gap-2">
                        <button
                            onClick={selectedMessageId ? updateMessage : addMessage}
                            className="flex-1 telegram-button"
                        >
                            {selectedMessageId ? 'Обновить' : 'Добавить'}
                        </button>
                        {selectedMessageId && (
                            <button
                                onClick={() => setSelectedMessageId(null)}
                                className="telegram-button secondary"
                            >
                                Отмена
                            </button>
                        )}
                    </div>
                </div>
            </div>
            </div>

            {/* Мобильная версия */}
            <div className="md:hidden flex-1 pb-16">
                {/* Панель сообщений (мобильная) */}
                {activeMobileTab === 'messages' && (
                    <div className="h-full bg-white flex flex-col">
                        <div className="p-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-800">Сообщения</h2>
                            <p className="text-sm text-gray-600">Перетащите для изменения порядка</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                            {messages.map((msg, index) => (
                                <div
                                    key={msg.id}
                                    className={`p-3 mb-2 rounded-lg cursor-pointer transition-colors panel ${
                                        selectedMessageId === msg.id
                                            ? 'bg-blue-100 border-blue-300'
                                            : 'bg-gray-50 hover:bg-gray-100'
                                    } border`}
                                    onClick={() => selectMessage(msg.id)}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                                            {msg.type === 'text' && '💬'}
                                            {msg.type === 'image' && '🖼️'}
                                            {msg.type === 'video' && '🎥'}
                                            {msg.type === 'file' && '📎'}
                                            {msg.type === 'poll' && '📊'}
                                            {msg.type === 'buttons' && '🔘'}
                                        </span>
                                        <span className="text-xs text-gray-500">#{index + 1}</span>
                                    </div>
                                    <div className="text-sm text-gray-800 truncate">
                                        {msg.content || msg.poll?.question || 'Без текста'}
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }}
                                            className="text-red-500 hover:text-red-700 text-xs"
                                        >
                                            Удалить
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => setSelectedMessageId(null)}
                                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors mb-4"
                            >
                                + Добавить сообщение
                            </button>

                            {/* Кнопка отправки всей рассылки */}
                            <button
                                onClick={sendMessageChain}
                                disabled={sending || messages.length === 0}
                                className="w-full telegram-button disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {sending ? 'Отправка...' : `Отправить рассылку (${messages.length} сообщений)`}
                            </button>
                        </div>
                    </div>
                )}

                {/* Превью чата (мобильная) */}
                {activeMobileTab === 'preview' && (
                    <div className="h-full bg-gray-50 flex flex-col">
                        <div className="p-4 border-b border-gray-200 bg-white">
                            <h2 className="text-lg font-semibold text-gray-800">Превью чата</h2>
                            <p className="text-sm text-gray-600">Как будут выглядеть сообщения</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <div className="w-full bg-white rounded-lg shadow-sm min-h-full">
                                {/* Заголовок чата */}
                                <div className="bg-blue-500 text-white p-3 rounded-t-lg">
                                    <h3 className="font-semibold">AntiTrash Astana</h3>
                                    <p className="text-sm opacity-90">Бот для рассылки</p>
                                </div>

                                {/* Сообщения */}
                                <div className="p-4 space-y-3 min-h-[400px]">
                                    {chatPreview.messages.map((msg, index) => (
                                        <div key={msg.id} className="flex justify-end message-appear">
                                            <div className="message-bubble sent">
                                                {msg.replyTo && (
                                                    <div className="bg-blue-400 p-2 rounded-lg mb-2 text-sm">
                                                        <div className="text-blue-100">Ответ на предыдущее</div>
                                                    </div>
                                                )}
                                                {msg.type === 'text' && <div>{msg.content}</div>}
                                                {msg.type === 'image' && msg.media && (
                                                    <div>
                                                        <img
                                                            src={`data:${msg.media.type};base64,${msg.media.data}`}
                                                            alt={msg.media.name}
                                                            className="rounded-lg mb-2 max-w-full"
                                                        />
                                                        {msg.caption && <div className="text-sm">{msg.caption}</div>}
                                                    </div>
                                                )}
                                                {msg.type === 'poll' && msg.poll && (
                                                    <div>
                                                        <div className="font-semibold mb-2">{msg.poll.question}</div>
                                                        {msg.poll.options.map((opt, i) => (
                                                            <div key={i} className="text-sm mb-1">• {opt}</div>
                                                        ))}
                                                    </div>
                                                )}
                                                {msg.type === 'buttons' && msg.buttons && (
                                                    <div>
                                                        {(msg.buttonText || msg.content) && (
                                                            <div className="mb-2">{msg.buttonText || msg.content}</div>
                                                        )}
                                                        <div className="space-y-1">
                                                            {msg.buttons.map((btn, i) => (
                                                                <button
                                                                    key={i}
                                                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm transition-colors"
                                                                >
                                                                    {btn.text}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Настройки (мобильная) */}
                {activeMobileTab === 'settings' && (
                    <div className="h-full bg-white flex flex-col">
                        <div className="p-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-800">
                                {selectedMessageId ? 'Редактировать сообщение' : 'Новое сообщение'}
                            </h2>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {/* Выбор типа сообщения */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Тип сообщения</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { type: 'text' as MessageType, label: 'Текст', icon: '💬' },
                                        { type: 'image' as MessageType, label: 'Фото', icon: '🖼️' },
                                        { type: 'video' as MessageType, label: 'Видео', icon: '🎥' },
                                        { type: 'file' as MessageType, label: 'Файл', icon: '📎' },
                                        { type: 'poll' as MessageType, label: 'Опрос', icon: '📊' },
                                        { type: 'buttons' as MessageType, label: 'Кнопки', icon: '🔘' }
                                    ].map(({ type, label, icon }) => (
                                        <button
                                            key={type}
                                            onClick={() => setNewMessageType(type)}
                                            className={`p-3 border rounded-lg text-sm transition-colors panel ${
                                                newMessageType === type
                                                    ? 'bg-blue-100 border-blue-300 text-blue-700'
                                                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            <div className="text-lg mb-1">{icon}</div>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Содержимое в зависимости от типа */}
                            {newMessageType === 'text' && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Текст сообщения</label>
                                    <textarea
                                        className="w-full telegram-input resize-none"
                                        rows={4}
                                        placeholder="Введите текст..."
                                        value={newMessageContent}
                                        onChange={(e) => setNewMessageContent(e.target.value)}
                                    />
                                </div>
                            )}

                            {(newMessageType === 'image' || newMessageType === 'video' || newMessageType === 'file') && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {newMessageType === 'image' && 'Выберите изображение'}
                                        {newMessageType === 'video' && 'Выберите видео'}
                                        {newMessageType === 'file' && 'Выберите файл'}
                                    </label>
                                    <input
                                        type="file"
                                        accept={
                                            newMessageType === 'image' ? 'image/*' :
                                            newMessageType === 'video' ? 'video/*' : '*'
                                        }
                                        onChange={(e) => handleFileChange(e, newMessageType as 'image' | 'video' | 'file')}
                                        className="w-full telegram-input"
                                    />
                                    {newMessageMediaData && (
                                        <div className="mt-2">
                                            {newMessageType === 'image' && (
                                                <img
                                                    src={`data:${newMessageMedia?.type};base64,${newMessageMediaData}`}
                                                    alt="preview"
                                                    className="w-full h-32 object-cover rounded-lg"
                                                />
                                            )}
                                            <input
                                                type="text"
                                                placeholder="Подпись (caption)"
                                                className="w-full mt-2 telegram-input text-sm"
                                                value={newMessageCaption}
                                                onChange={(e) => setNewMessageCaption(e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {newMessageType === 'poll' && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Вопрос опроса</label>
                                    <input
                                        type="text"
                                        className="w-full telegram-input mb-3"
                                        placeholder="Введите вопрос..."
                                        value={newMessagePoll.question}
                                        onChange={(e) => setNewMessagePoll({...newMessagePoll, question: e.target.value})}
                                    />

                                    <label className="block text-sm font-medium text-gray-700 mb-2">Варианты ответа</label>
                                    {newMessagePoll.options.map((option, index) => (
                                        <div key={index} className="flex gap-2 mb-2">
                                            <input
                                                type="text"
                                                className="flex-1 telegram-input text-sm"
                                                placeholder={`Вариант ${index + 1}`}
                                                value={option}
                                                onChange={(e) => updatePollOption(index, e.target.value)}
                                            />
                                            {newMessagePoll.options.length > 2 && (
                                                <button
                                                    onClick={() => removePollOption(index)}
                                                    className="text-red-500 hover:text-red-700 px-2"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        onClick={addPollOption}
                                        className="text-blue-500 hover:text-blue-700 text-sm mb-3"
                                    >
                                        + Добавить вариант
                                    </button>

                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={newMessagePoll.is_anonymous}
                                                onChange={(e) => setNewMessagePoll({...newMessagePoll, is_anonymous: e.target.checked})}
                                            />
                                            <span className="text-sm">Анонимный опрос</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={newMessagePoll.allows_multiple_answers}
                                                onChange={(e) => setNewMessagePoll({...newMessagePoll, allows_multiple_answers: e.target.checked})}
                                            />
                                            <span className="text-sm">Разрешить несколько ответов</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {newMessageType === 'buttons' && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Текст сообщения с кнопками</label>
                                    <input
                                        type="text"
                                        className="w-full telegram-input mb-4"
                                        placeholder="Введите текст, который увидят пользователи (или оставьте пустым для стандартного)"
                                        value={newMessageButtonText}
                                        onChange={(e) => setNewMessageButtonText(e.target.value)}
                                    />

                                    <label className="block text-sm font-medium text-gray-700 mb-2">Inline кнопки</label>
                                    {newMessageButtons.map((button, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-3 mb-3 panel">
                                            <input
                                                type="text"
                                                placeholder="Текст кнопки"
                                                className="w-full telegram-input mb-2 text-sm"
                                                value={button.text}
                                                onChange={(e) => updateButton(index, 'text', e.target.value)}
                                            />
                                            <select
                                                className="w-full telegram-input mb-2 text-sm"
                                                value={button.action}
                                                onChange={(e) => updateButton(index, 'action', e.target.value)}
                                            >
                                                <option value="reply">Отправить ответ</option>
                                                <option value="url">Открыть ссылку</option>
                                                <option value="callback">Callback</option>
                                                <option value="next_message">Следующее сообщение</option>
                                            </select>
                                            {button.action !== 'callback' && (
                                                <input
                                                    type="text"
                                                    placeholder={
                                                        button.action === 'reply' ? 'Текст ответа' :
                                                        button.action === 'url' ? 'URL' : 'ID сообщения'
                                                    }
                                                    className="w-full telegram-input text-sm"
                                                    value={button.value}
                                                    onChange={(e) => updateButton(index, 'value', e.target.value)}
                                                />
                                            )}
                                            {button.action === 'callback' && (
                                                <div className="text-xs text-gray-500 mt-1 p-2 bg-gray-50 rounded">
                                                    Для callback кнопок значение генерируется автоматически: вопрос + текст кнопки
                                                </div>
                                            )}
                                            <button
                                                onClick={() => removeButton(index)}
                                                className="text-red-500 hover:text-red-700 text-sm mt-2"
                                            >
                                                Удалить кнопку
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={addButton}
                                        className="w-full p-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors text-sm"
                                    >
                                        + Добавить кнопку
                                    </button>
                                </div>
                            )}

                            {/* Ответ на сообщение */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Ответ на сообщение</label>
                                <select
                                    className="w-full telegram-input"
                                    value={replyTo || ''}
                                    onChange={(e) => setReplyTo(e.target.value || null)}
                                >
                                    <option value="">Не отвечать</option>
                                    {messages.map((msg, index) => (
                                        <option key={msg.id} value={msg.id}>
                                            #{index + 1} {msg.content.substring(0, 30)}...
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Кнопки действий */}
                            <div className="flex gap-2">
                                <button
                                    onClick={selectedMessageId ? updateMessage : addMessage}
                                    className="flex-1 telegram-button"
                                >
                                    {selectedMessageId ? 'Обновить' : 'Добавить'}
                                </button>
                                {selectedMessageId && (
                                    <button
                                        onClick={() => setSelectedMessageId(null)}
                                        className="telegram-button secondary"
                                    >
                                        Отмена
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
