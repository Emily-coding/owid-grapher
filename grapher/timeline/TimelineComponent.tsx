import * as React from "react"
import { select } from "d3-selection"
import { getRelativeMouse, isMobile, debounce } from "grapher/utils/Util"
import { Bounds } from "grapher/utils/Bounds"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { faPlay } from "@fortawesome/free-solid-svg-icons/faPlay"
import { faPause } from "@fortawesome/free-solid-svg-icons/faPause"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import Tippy from "@tippyjs/react"
import classNames from "classnames"
import { TimelineController } from "./TimelineController"

const HANDLE_TOOLTIP_FADE_TIME_MS = 2000

@observer
export class TimelineComponent extends React.Component<{
    timelineController: TimelineController
}> {
    base: React.RefObject<HTMLDivElement> = React.createRef()

    @observable private dragTarget?: "start" | "end" | "both"

    @computed private get isDragging() {
        return !!this.dragTarget
    }

    @computed private get manager() {
        return this.props.timelineController.manager
    }

    @computed private get controller() {
        return this.props.timelineController
    }

    private get sliderBounds() {
        return this.slider
            ? Bounds.fromRect(this.slider.getBoundingClientRect())
            : new Bounds(0, 0, 100, 100)
    }

    private slider?: Element | HTMLElement | null
    private playButton?: Element | HTMLElement | null

    private getInputTimeFromMouse(event: MouseEvent) {
        const { minTime, maxTime } = this.controller
        const mouseX = getRelativeMouse(this.slider, event).x

        const fracWidth = mouseX / this.sliderBounds.width
        return minTime + fracWidth * (maxTime - minTime)
    }

    @action.bound private onDrag(inputTime: number) {
        this.dragTarget = this.controller.dragHandleToTime(
            this.dragTarget!,
            inputTime
        )
        this.showTooltips()
    }

    @action.bound private showTooltips() {
        this.hideStartTooltip.cancel()
        this.hideEndTooltip.cancel()
        this.startTooltipVisible = true
        this.endTooltipVisible = true

        if (this.dragTarget === "start") this.lastUpdatedTooltip = "startMarker"
        if (this.dragTarget === "end") this.lastUpdatedTooltip = "endMarker"
        if (this.controller.startTime > this.controller.endTime)
            this.lastUpdatedTooltip =
                this.lastUpdatedTooltip === "startMarker"
                    ? "endMarker"
                    : "startMarker"
    }

    private getDragTarget(
        inputTime: number,
        isStartMarker: boolean,
        isEndMarker: boolean
    ) {
        const { startTime, endTime } = this.controller

        if (startTime === endTime && (isStartMarker || isEndMarker))
            return "both"
        else if (isStartMarker || inputTime <= startTime) return "start"
        else if (isEndMarker || inputTime >= endTime) return "end"
        return "both"
    }

    @action.bound private onMouseDown(event: any) {
        const logic = this.controller
        const targetEl = select(event.target)

        const inputTime = this.getInputTimeFromMouse(event)

        this.dragTarget = this.getDragTarget(
            inputTime,
            targetEl.classed("startMarker"),
            targetEl.classed("endMarker")
        )

        if (this.dragTarget === "both") logic.setDragOffsets(inputTime)

        this.onDrag(inputTime)
        event.preventDefault()
    }

    private queuedDrag?: boolean
    @action.bound private onMouseMove(event: MouseEvent | TouchEvent) {
        const { dragTarget } = this
        if (!dragTarget) return
        if (this.queuedDrag) return

        this.queuedDrag = true
        this.onDrag(this.getInputTimeFromMouse(event as any))
        this.queuedDrag = false
    }

    @action.bound private onMouseUp() {
        this.dragTarget = undefined

        if (this.manager.isPlaying) return

        if (isMobile()) {
            if (this.startTooltipVisible) this.hideStartTooltip()
            if (this.endTooltipVisible) this.hideEndTooltip()
        } else if (!this.mouseHoveringOverTimeline) {
            this.startTooltipVisible = false
            this.endTooltipVisible = false
        }

        this.controller.snapTimes()
    }

    private mouseHoveringOverTimeline: boolean = false
    @action.bound private onMouseOver() {
        this.mouseHoveringOverTimeline = true

        this.hideStartTooltip.cancel()
        this.startTooltipVisible = true

        this.hideEndTooltip.cancel()
        this.endTooltipVisible = true
    }

    @action.bound private onMouseLeave() {
        if (!this.manager.isPlaying && !this.isDragging) {
            this.startTooltipVisible = false
            this.endTooltipVisible = false
        }
        this.mouseHoveringOverTimeline = false
    }

    private hideStartTooltip = debounce(() => {
        this.startTooltipVisible = false
    }, HANDLE_TOOLTIP_FADE_TIME_MS)
    private hideEndTooltip = debounce(() => {
        this.endTooltipVisible = false
    }, HANDLE_TOOLTIP_FADE_TIME_MS)

    @action.bound onPlayTouchEnd(e: Event) {
        e.preventDefault()
        e.stopPropagation()
        this.controller.togglePlay()
    }

    @computed private get isPlayingOrDragging() {
        return this.manager.isPlaying || this.isDragging
    }

    componentDidMount() {
        const current = this.base.current

        if (current) {
            this.slider = current.querySelector(".slider")
            this.playButton = current.querySelector(".play")
        }

        document.documentElement.addEventListener("mouseup", this.onMouseUp)
        document.documentElement.addEventListener("mouseleave", this.onMouseUp)
        document.documentElement.addEventListener("mousemove", this.onMouseMove)
        document.documentElement.addEventListener("touchend", this.onMouseUp)
        document.documentElement.addEventListener("touchmove", this.onMouseMove)
        this.slider?.addEventListener("touchstart", this.onMouseDown, {
            passive: false,
        })
        this.playButton?.addEventListener("touchend", this.onPlayTouchEnd, {
            passive: false,
        })
    }

    componentWillUnmount() {
        document.documentElement.removeEventListener("mouseup", this.onMouseUp)
        document.documentElement.removeEventListener(
            "mouseleave",
            this.onMouseUp
        )
        document.documentElement.removeEventListener(
            "mousemove",
            this.onMouseMove
        )
        document.documentElement.removeEventListener("touchend", this.onMouseUp)
        document.documentElement.removeEventListener(
            "touchmove",
            this.onMouseMove
        )
        this.slider?.removeEventListener("touchstart", this.onMouseDown, {
            passive: false,
        } as EventListenerOptions)
        this.playButton?.removeEventListener("touchend", this.onPlayTouchEnd, {
            passive: false,
        } as EventListenerOptions)
    }

    private formatTime(time: number) {
        return this.manager.formatTimeFn
            ? this.manager.formatTimeFn(time)
            : time
    }

    private timelineEdgeMarker(markerType: "start" | "end") {
        const { controller } = this
        const time =
            markerType === "start" ? controller.minTime : controller.maxTime
        return (
            <div
                className="date clickable"
                onClick={() =>
                    markerType === "start"
                        ? controller.resetStartToMin()
                        : controller.resetEndToMax()
                }
            >
                {this.formatTime(time)}
            </div>
        )
    }

    @observable private startTooltipVisible: boolean = false
    @observable private endTooltipVisible: boolean = false
    @observable private lastUpdatedTooltip?: "startMarker" | "endMarker"

    @action.bound private togglePlay() {
        this.controller.togglePlay()
    }

    render() {
        const { manager, controller } = this
        const {
            startTime,
            endTime,
            startTimeProgress,
            endTimeProgress,
        } = controller

        return (
            <div
                ref={this.base}
                className="TimelineComponent"
                onMouseOver={this.onMouseOver}
                onMouseLeave={this.onMouseLeave}
            >
                {!this.manager.disablePlay && (
                    <div
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={this.togglePlay}
                        className="play"
                    >
                        {manager.isPlaying ? (
                            <FontAwesomeIcon icon={faPause} />
                        ) : (
                            <FontAwesomeIcon icon={faPlay} />
                        )}
                    </div>
                )}
                {this.timelineEdgeMarker("start")}
                <div
                    className="slider clickable"
                    onMouseDown={this.onMouseDown}
                >
                    <TimelineHandle
                        type="startMarker"
                        offsetPercent={startTimeProgress * 100}
                        tooltipContent={this.formatTime(startTime)}
                        tooltipVisible={this.startTooltipVisible}
                        tooltipZIndex={
                            this.lastUpdatedTooltip === "startMarker" ? 2 : 1
                        }
                    />
                    <div
                        className="interval"
                        style={{
                            left: `${startTimeProgress * 100}%`,
                            right: `${100 - endTimeProgress * 100}%`,
                        }}
                    />
                    <TimelineHandle
                        type="endMarker"
                        offsetPercent={endTimeProgress * 100}
                        tooltipContent={this.formatTime(endTime)}
                        tooltipVisible={this.endTooltipVisible}
                        tooltipZIndex={
                            this.lastUpdatedTooltip === "endMarker" ? 2 : 1
                        }
                    />
                </div>
                {this.timelineEdgeMarker("end")}
            </div>
        )
    }
}

const TimelineHandle = ({
    type,
    offsetPercent,
    tooltipContent,
    tooltipVisible,
    tooltipZIndex,
}: {
    type: "startMarker" | "endMarker"
    offsetPercent: number
    tooltipContent: string
    tooltipVisible: boolean
    tooltipZIndex: number
}) => {
    return (
        <div
            className={classNames("handle", type)}
            style={{
                left: `${offsetPercent}%`,
            }}
        >
            <Tippy
                content={tooltipContent}
                visible={tooltipVisible}
                zIndex={tooltipZIndex}
            >
                <div className="icon" />
            </Tippy>
        </div>
    )
}
