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

export default function Home() {
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [image, setImage] = useState<File | null>(null);
    const [imageData, setImageData] = useState<string | null>(null);

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

                <div className="mt-6 flex flex-col gap-4">
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
            </div>
        </main>
    );
}
