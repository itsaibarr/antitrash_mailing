"use client";
import { useState } from "react";

type ImagePayload = {
    data: string;
    name?: string;
    type?: string;
};

type Payload = {
    message: string;
    image?: ImagePayload;
};

type PollPayload = {
    question: string;
    options: string[];
    is_anonymous?: boolean;
    allows_multiple_answers?: boolean;
};

export default function Home() {
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [image, setImage] = useState<File | null>(null);
    const [imageData, setImageData] = useState<string | null>(null);

    // Poll states
    const [pollQuestion, setPollQuestion] = useState("");
    const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
    const [isAnonymous, setIsAnonymous] = useState(true);
    const [allowsMultiple, setAllowsMultiple] = useState(false);

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setImage(file);
        if (!file) {
            setImageData(null);
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // data:<type>;base64,<data>
            const base = result.split(",")[1];
            setImageData(base);
        };
        reader.readAsDataURL(file);
    };

    const updatePollOption = (index: number, value: string) => {
        const newOptions = [...pollOptions];
        newOptions[index] = value;
        setPollOptions(newOptions);
    };

    const addPollOption = () => {
        setPollOptions([...pollOptions, ""]);
    };

    const removePollOption = (index: number) => {
        if (pollOptions.length > 2) {
            setPollOptions(pollOptions.filter((_, i) => i !== index));
        }
    };

    const sendPoll = async () => {
        if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) {
            alert("Введите вопрос и минимум 2 варианта ответа");
            return;
        }
        setLoading(true);
        try {
            const payload: PollPayload = {
                question: pollQuestion,
                options: pollOptions.filter(o => o.trim()),
                is_anonymous: isAnonymous,
                allows_multiple_answers: allowsMultiple,
            };

            const res = await fetch("/api/send/poll", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const body = await res.json();

            if (!res.ok) {
                alert("❌ Ошибка при отправке опроса: " + (body.error || "Неизвестная ошибка"));
            } else {
                alert("✅ Опрос отправлен!");
                // Reset form
                setPollQuestion("");
                setPollOptions(["", ""]);
                setIsAnonymous(true);
                setAllowsMultiple(false);
            }
        } catch (err: unknown) {
            console.error(err);
            alert("❌ Ошибка при отправке опроса: " + String(err));
        } finally {
            setLoading(false);
        }
    };

    const send = async () => {
        setLoading(true);
        try {
            // ограничение размера — 4 МБ
            const MAX_BYTES = 4 * 1024 * 1024;
            if (image && image.size > MAX_BYTES) {
                alert("Файл слишком большой. Максимум 4 МБ.");
                setLoading(false);
                return;
            }

            const payload: Payload = { message };
            if (imageData) {
                payload.image = {
                    data: imageData,
                    name: image?.name,
                    type: image?.type,
                };
            }

            const res = await fetch("/api/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            type ResponseBody = { error?: string; message?: string; failures?: Array<{ id: string | number; error: string }>; };

            let body: unknown = null;
            try {
                body = await res.json();
            } catch {
                // no json
            }

            console.log("send response:", res.status, body);

            if (!res.ok) {
                const b = body as ResponseBody | null;
                let errMsg = b?.error || b?.message || `Статус ${res.status}`;
                if (b?.failures) {
                    errMsg += "\nFailures: " + JSON.stringify(b.failures);
                }
                alert("❌ Ошибка при отправке: " + errMsg);
            } else {
                alert("✅ Рассылка выполнена!");
            }
        } catch (err: unknown) {
            console.error(err);
            alert("❌ Ошибка при отправке: " + String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-8 gap-6">
            <div className="w-full max-w-3xl">
                <h1 className="text-2xl sm:text-3xl font-bold text-[#820000] text-center">AntiTrash Astana</h1>
                <h2 className="text-base sm:text-lg font-semibold text-center mt-2">
                    Привет! Напиши сообщение, которым хочешь поделиться с другими.
                    <br className="hidden sm:inline" />
                    Пожалуйста, будь уважителен — не спамь и используй бота только по назначению.
                </h2>

                {/* Message Form */}
                <div className="mt-6 flex flex-col gap-4">
                    <h3 className="text-lg font-semibold">Отправить сообщение</h3>
                    <textarea
                        className="border p-3 w-full min-h-[6rem] sm:min-h-[8rem] rounded-md resize-vertical"
                        placeholder="Введите сообщение"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    />

                    <label className="flex flex-col items-start gap-2">
                        <input type="file" accept="image/*" onChange={onFileChange} />
                        {imageData && (
                            // small preview — responsive width
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={`data:${image?.type};base64,${imageData}`}
                                alt="preview"
                                className="w-full sm:w-48 h-auto rounded-md object-contain mt-2"
                            />
                        )}
                    </label>

                    <div className="flex w-full justify-center">
                        <button
                            className="w-full sm:w-auto bg-[#820000] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#5a0000]"
                            disabled={loading}
                            onClick={send}
                        >
                            {loading ? "Отправка..." : "Отправить всем"}
                        </button>
                    </div>
                </div>

                {/* Poll Form */}
                <div className="mt-8 flex flex-col gap-4">
                    <h3 className="text-lg font-semibold">Создать опрос</h3>
                    <input
                        type="text"
                        className="border p-3 w-full rounded-md"
                        placeholder="Вопрос опроса"
                        value={pollQuestion}
                        onChange={(e) => setPollQuestion(e.target.value)}
                    />

                    <div className="flex flex-col gap-2">
                        <label>Варианты ответа:</label>
                        {pollOptions.map((option, index) => (
                            <div key={index} className="flex gap-2 items-center">
                                <input
                                    type="text"
                                    className="border p-2 flex-1 rounded-md"
                                    placeholder={`Вариант ${index + 1}`}
                                    value={option}
                                    onChange={(e) => updatePollOption(index, e.target.value)}
                                />
                                {pollOptions.length > 2 && (
                                    <button
                                        type="button"
                                        className="bg-red-500 text-white px-3 py-2 rounded-md"
                                        onClick={() => removePollOption(index)}
                                    >
                                        Удалить
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            type="button"
                            className="bg-green-500 text-white px-4 py-2 rounded-md self-start"
                            onClick={addPollOption}
                        >
                            Добавить вариант
                        </button>
                    </div>

                    <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={isAnonymous}
                                onChange={(e) => setIsAnonymous(e.target.checked)}
                            />
                            Анонимный опрос
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={allowsMultiple}
                                onChange={(e) => setAllowsMultiple(e.target.checked)}
                            />
                            Разрешить несколько ответов
                        </label>
                    </div>

                    <div className="flex w-full justify-center">
                        <button
                            className="w-full sm:w-auto bg-[#820000] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#5a0000]"
                            disabled={loading}
                            onClick={sendPoll}
                        >
                            {loading ? "Отправка..." : "Отправить опрос"}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}
