import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function Esp32Simulator() {
  const [pin, setPin] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, message]);
  };

  const handleKeyPress = async (key: string) => {
    if (key === "*") {
      setPin("");
      addLog("🔄 PIN Cleared");
    } else if (key === "#") {
      if (pin.length !== 4) {
        addLog("❌ PIN must be 4 digits!");
        return;
      }
      addLog(`🔐 Checking access for PIN: ${pin}`);
      try {
        const res = await fetch(`/esp32?pin=${pin}`);
        const data = await res.json();
        if (data.success) {
          addLog(`✅ Access granted for user ID ${data.user_id}`);
          addLog(
            `Certifications: EQUIP:${data.certifications.equipment_certified} | MILL:${data.certifications.mill_certified} | CNC:${data.certifications.cnc_certified} | WELDER:${data.certifications.welder_certified}`
          );
        } else {
          addLog(`❌ ${data.error}`);
        }
      } catch (err) {
        addLog("🚨 Error connecting to server");
      }
      setPin("");
    } else if (pin.length < 4) {
      setPin((prev) => prev + key);
    }
  };

  const keypadKeys = ["1","2","3","A","4","5","6","B","7","8","9","C","*","0","#","D"];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6">
      <h1 className="text-2xl font-bold mb-4">ESP32 Keypad Simulator</h1>

      {/* PIN display */}
      <div className="mb-4 text-2xl font-mono tracking-widest">
        {pin.padEnd(4, "_")}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {keypadKeys.map((k) => (
          <Button
            key={k}
            onClick={() => handleKeyPress(k)}
            className="text-lg h-16 w-16"
            variant={["*","#"].includes(k) ? "destructive" : "default"}
          >
            {k}
          </Button>
        ))}
      </div>

      {/* Logs */}
      <div className="bg-white w-full max-w-lg p-4 rounded-xl shadow-md h-64 overflow-y-auto font-mono text-sm">
        {logs.length === 0 ? (
          <p className="text-gray-400">No activity yet...</p>
        ) : (
          logs.map((log, i) => <p key={i}>{log}</p>)
        )}
      </div>
    </div>
  );
}
