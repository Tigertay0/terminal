import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
