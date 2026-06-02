import mqtt from "mqtt";
import { useCallback, useEffect, useRef, useState } from "react";

export interface PressIoTReading {
  value_temp_1: number; // Hot Temp °C
  value_temp_2: number; // Cold Temp °C
  value_run_ok: number; // cycle count
  receivedAt: number;   // Date.now()
}

export interface PressIoTCycle {
  cycleNo: number;
  hotTemp: number;
  coldTemp: number;
  completedAt: number;
}

export type PressIoTStatus = "connecting" | "connected" | "disconnected" | "off";

const MAX_HISTORY = 120;
const MAX_CYCLES = 50;

export function usePressIoT(machineIotId?: string) {
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState<PressIoTStatus>("connecting");
  const [latest, setLatest] = useState<PressIoTReading | null>(null);
  const [history, setHistory] = useState<PressIoTReading[]>([]);
  const [cycles, setCycles] = useState<PressIoTCycle[]>([]);

  const lastCycleNoRef = useRef<number | null>(null);
  const clientRef = useRef<mqtt.MqttClient | null>(null);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.end(true);
      clientRef.current = null;
    }
    setStatus("off");
    setEnabled(false);
  }, []);

  const connect = useCallback(() => {
    setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled || !machineIotId) return;

    const host = process.env.REACT_APP_MQTT_BROKER_HOST;
    const port = process.env.REACT_APP_MQTT_BROKER_PORT || "8884";
    const username = process.env.REACT_APP_MQTT_USERNAME;
    const password = process.env.REACT_APP_MQTT_PASSWORD;
    const baseTopic = process.env.REACT_APP_MQTT_TOPIC || "press_machine";
    const topic = `${baseTopic}/${machineIotId}`;

    if (!host || !username || !password) return;

    setStatus("connecting");

    const url = `wss://${host}:${port}/mqtt`;
    const client = mqtt.connect(url, {
      username,
      password,
      clientId: `mes-press-${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      reconnectPeriod: 3000,
    });
    clientRef.current = client;

    client.on("connect", () => {
      setStatus("connected");
      client.subscribe(topic, { qos: 1 });
    });

    client.on("reconnect", () => setStatus("connecting"));
    client.on("disconnect", () => setStatus("disconnected"));
    client.on("error", () => setStatus("disconnected"));

    client.on("message", (_topic: string, payload: Buffer) => {
      try {
        const data = JSON.parse(payload.toString()) as {
          value_temp_1: number;
          value_temp_2: number;
          value_run_ok: number;
        };

        const reading: PressIoTReading = {
          value_temp_1: data.value_temp_1,
          value_temp_2: data.value_temp_2,
          value_run_ok: data.value_run_ok,
          receivedAt: Date.now(),
        };

        setLatest(reading);
        setHistory((prev) => {
          const next = [...prev, reading];
          return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
        });

        if (
          lastCycleNoRef.current !== null &&
          data.value_run_ok > lastCycleNoRef.current
        ) {
          const newCycle: PressIoTCycle = {
            cycleNo: data.value_run_ok,
            hotTemp: data.value_temp_1,
            coldTemp: data.value_temp_2,
            completedAt: Date.now(),
          };
          setCycles((prev) => {
            const next = [newCycle, ...prev];
            return next.length > MAX_CYCLES ? next.slice(0, MAX_CYCLES) : next;
          });
        }
        lastCycleNoRef.current = data.value_run_ok;
      } catch {
        // ignore malformed messages
      }
    });

    return () => {
      client.end(true);
      clientRef.current = null;
    };
  }, [enabled, machineIotId]);

  return {
    status,
    enabled,
    latest,
    history,
    cycles,
    machineIotId: machineIotId ?? "",
    connect,
    disconnect,
  };
}
