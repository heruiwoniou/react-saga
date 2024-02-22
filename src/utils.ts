import { AnyAction } from "redux-saga";
import {
  CombineEffects,
  EffectMap,
  EffectsStructure,
  EffectsGeneratorFunction,
} from ".";

export const META_SYMBOL = "@@META";

export const SET_SYMBOL = "@@SET_SYMBOL";

export const EMPTY_OBJECT = {};

export const EMPTY_ARRAY = [];

let ID = 1;
export const uniqueId = () => {
  return String(ID++);
};

export function isGenerator(target: any): boolean {
  return target.constructor.name === "GeneratorFunction";
}

export function flattenEntries<
  A extends AnyAction,
  EffectsMethods extends CombineEffects
>(
  methods: EffectMap<A, EffectsMethods>,
  scope: string[] = [],
  result: EffectsStructure<A, EffectsMethods>[] = []
) {
  const entries = Object.entries(methods);
  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i];
    if (isGenerator(value)) {
      result.push({
        scope,
        key,
        generator: value as EffectsGeneratorFunction<A, EffectsMethods>,
      });
    } else {
      flattenEntries(
        value as EffectMap<A, EffectsMethods>,
        [...scope, key],
        result
      );
    }
  }

  return result;
}
