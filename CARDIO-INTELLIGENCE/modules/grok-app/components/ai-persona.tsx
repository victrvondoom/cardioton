"use client";

import type { LucideIcon } from "lucide-react";
import {
  BrainIcon,
  CircleIcon,
  EyeClosedIcon,
  MegaphoneIcon,
  MicIcon,
} from "lucide-react";
import { memo, useCallback, useState } from "react";
import type { PersonaState } from "@/components/ai-elements/persona";
import { Persona } from "@/components/ai-elements/persona";
import { Button } from "@/components/ui/grok_app__components_ui__button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/grok_app__components_ui__tooltip";

const states: {
  state: PersonaState;
  icon: LucideIcon;
  label: string;
}[] = [
  { icon: CircleIcon, label: "Idle", state: "idle" },
  { icon: MicIcon, label: "Listening", state: "listening" },
  { icon: BrainIcon, label: "Thinking", state: "thinking" },
  { icon: MegaphoneIcon, label: "Speaking", state: "speaking" },
  { icon: EyeClosedIcon, label: "Asleep", state: "asleep" },
];

interface StateButtonProps {
  state: (typeof states)[0];
  currentState: PersonaState;
  onStateChange: (state: PersonaState) => void;
}

const StateButton = memo(
  ({ state, currentState, onStateChange }: StateButtonProps) => {
    const handleClick = useCallback(
      () => onStateChange(state.state),
      [onStateChange, state.state],
    );
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleClick}
            size="icon-sm"
            variant={currentState === state.state ? "default" : "outline"}
          >
            <state.icon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{state.label}</TooltipContent>
      </Tooltip>
    );
  },
);

StateButton.displayName = "StateButton";

export function AIPersona() {
  const [currentState, setCurrentState] = useState<PersonaState>("idle");

  const handleStateChange = useCallback((state: PersonaState) => {
    setCurrentState(state);
  }, []);

  return (
    <div className="flex size-full flex-col items-center justify-center gap-4">
      <Persona className="size-64" state={currentState} variant="halo" />
      <ButtonGroup orientation="horizontal">
        {states.map((state) => (
          <StateButton
            currentState={currentState}
            key={state.state}
            onStateChange={handleStateChange}
            state={state}
          />
        ))}
      </ButtonGroup>
    </div>
  );
}
