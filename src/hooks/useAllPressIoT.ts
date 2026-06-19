import mqtt from "mqtt";
import { useEffect, useRef, useState } from "react";
import { PressIoTReading } from "./usePressIoT";

export type AllPressIoTMap = Map<string, PressIoTReading>;

export function useAllPressIoT(): AllPressIoTMap {
  const [readings, setReadings] = useState<AllPressIoTMap>(new Map());
  const clientRef = useRef<mqtt.MqttClient | null>(null);

  useEffect(() => {
    const host     = process.env.REACT_APP_MQTT_BROKER_HOST;
    const port     = process.env.REACT_APP_MQTT_BROKER_PORT || "8884";
    const username = process.env.REACT_APP_MQTT_USERNAME;
    const password = process.env.REACT_APP_MQTT_PASSWORD;
    const baseTopic = process.env.REACT_APP_MQTT_TOPIC || "press_machine";

    if (!host || !username || !password) return;

    const url = `wss://${host}:${port}/mqtt`;
    const client = mqtt.connect(url, {
      username,
      password,
      clientId: `mes-list-${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      reconnectPeriod: 5000,
    });
    clientRef.current = client;

    client.on("connect", () => {
      client.subscribe(`${baseTopic}/+`, { qos: 1 });
    });

    client.on("message", (topic: string, payload: Buffer) => {
      try {
        const data = JSON.parse(payload.toString()) as {
          machine_iot_id?: string;
          value_temp_1: number;
          value_temp_2: number;
          value_run_ok: number;
          value_time_hot?: number;
          value_time_cold?: number;
          value_time_cycle?: number;
        };

        // Extract machineId from topic (press_machine/1 → "1") or payload field
        const topicParts = topic.split("/");
        const machineId = topicParts[topicParts.length - 1] || data.machine_iot_id;
        if (!machineId) return;

        const reading: PressIoTReading = {
          value_temp_1: data.value_temp_1,
          value_temp_2: data.value_temp_2,
          value_run_ok: data.value_run_ok,
          value_time_hot: data.value_time_hot,
          value_time_cold: data.value_time_cold,
          value_time_cycle: data.value_time_cycle,
          receivedAt: Date.now(),
        };

        setReadings((prev) => {
          const next = new Map(prev);
          next.set(String(machineId), reading);
          return next;
        });
      } catch {
        // ignore malformed messages
      }
    });

    return () => {
      client.end(true);
      clientRef.current = null;
    };
  }, []);

  return readings;
}
