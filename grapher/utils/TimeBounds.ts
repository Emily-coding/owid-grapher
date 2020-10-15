import {
    parseIntOrUndefined,
    isString,
    diffDateISOStringInDays,
    formatDay,
} from "grapher/utils/Util"
import { EPOCH_DATE } from "grapher/core/GrapherConstants"

/**
 * The two special TimeBound values: unbounded left & unbounded right.
 */
export enum TimeBoundValue {
    unboundedLeft = "earliest",
    unboundedRight = "latest",
}

/**
 * An unbounded value ("earliest" or "latest") or a concrete point in time (year or date).
 */
export type TimeBound = number | TimeBoundValue

export type TimeBounds = [TimeBound, TimeBound]

export function isUnbounded(time: TimeBound | string): time is TimeBoundValue {
    return isUnboundedLeft(time) || isUnboundedRight(time)
}

export function isUnboundedLeft(
    time: TimeBound | string
): time is TimeBoundValue.unboundedLeft {
    return time === TimeBoundValue.unboundedLeft
}

export function isUnboundedRight(
    time: TimeBound | string
): time is TimeBoundValue.unboundedRight {
    return time === TimeBoundValue.unboundedRight
}

export function formatTimeBound(t: TimeBound): string {
    return `${t}`
}

export function parseTimeBound(str: string, defaultTo: TimeBound): TimeBound {
    if (isUnbounded(str)) return str
    return parseIntOrUndefined(str) ?? defaultTo
}

// Use this to not repeat logic
function fromJSON(
    value: TimeBound | string | undefined,
    defaultValue: TimeBound
) {
    if (isString(value)) return parseTimeBound(value, defaultValue)
    if (value === undefined) return defaultValue
    return value
}

function toJSON(time: TimeBound | undefined): string | number | undefined {
    return time
}

export function minTimeFromJSON(
    minTime: TimeBound | string | undefined
): TimeBound {
    return fromJSON(minTime, TimeBoundValue.unboundedLeft)
}

export function maxTimeFromJSON(
    maxTime: TimeBound | string | undefined
): TimeBound {
    return fromJSON(maxTime, TimeBoundValue.unboundedRight)
}

export const minTimeToJSON = toJSON
export const maxTimeToJSON = toJSON

const reISODateComponent = new RegExp("\\d{4}-[01]\\d-[0-3]\\d")
const reISODate = new RegExp(`^(${reISODateComponent.source})$`)

export function formatTimeURIComponent(
    time: TimeBound,
    isDate: boolean
): string {
    if (isUnbounded(time)) return formatTimeBound(time)
    return isDate ? formatDay(time, { format: "YYYY-MM-DD" }) : `${time}`
}

export function parseTimeURIComponent(
    param: string,
    defaultValue: TimeBound
): TimeBound {
    return reISODate.test(param)
        ? diffDateISOStringInDays(param, EPOCH_DATE)
        : parseTimeBound(param, defaultValue)
}

const upgradeLegacyTimeString = (time: string) => {
    // In the past we supported unbounded time parameters like time=2015.. which would be
    // equivalent to time=2015..latest. We don't actively generate these kinds of URL any
    // more because URLs ending with dots are not interpreted correctly by many services
    // (Twitter, Facebook and others) - but we still want to recognize incoming requests
    // for these "legacy" URLs!
    if (time === "..") return "earliest..latest"
    return time.endsWith("..")
        ? time + "latest"
        : time.startsWith("..")
        ? "earliest" + time
        : time
}

export function getTimeDomainFromQueryString(time: string): TimeBounds {
    time = upgradeLegacyTimeString(time)

    const reIntComponent = new RegExp("\\-?\\d+")
    const reIntRange = new RegExp(
        `^(${reIntComponent.source}|earliest)\\.\\.(${reIntComponent.source}|latest)$`
    )
    const reDateRange = new RegExp(
        `^(${reISODateComponent.source}|earliest)\\.\\.(${reISODateComponent.source}|latest)$`
    )
    if (reIntRange.test(time) || reDateRange.test(time)) {
        const [start, end] = time.split("..")
        return [
            parseTimeURIComponent(start, TimeBoundValue.unboundedLeft),
            parseTimeURIComponent(end, TimeBoundValue.unboundedRight),
        ]
    }

    const t = parseTimeURIComponent(time, TimeBoundValue.unboundedRight)
    return [t, t]
}

/**
 * Strictly convert to number, using ±Infinsity for "earliest" and "latest".
 * Helpful for Admin forms, where the value must be a number.
 */
export function timeBoundToNumber(
    time: TimeBound | undefined
): number | undefined {
    if (time === undefined) return undefined
    if (isUnboundedLeft(time)) return -Infinity
    if (isUnboundedRight(time)) return Infinity
    return time
}
