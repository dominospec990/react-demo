// @flow

import memoizeOne from 'memoize-one';
import React from 'react';

export type ScrollToAlign = 'auto' | 'center' | 'start' | 'end';

type CellSize = number | ((index: number) => number);
type Direction = 'horizontal' | 'vertical';

type RenderFunction = ({
  index: number,
  key: string,
  style: Object,
}) => React$Node;

type ScrollDirection = 'forward' | 'backward';

type onItemsRenderedCallback = ({
  overscanStartIndex: number,
  overscanStopIndex: number,
  visibleStartIndex: number,
  visibleStopIndex: number,
}) => void;
type onScrollCallback = ({
  scrollDirection: ScrollDirection,
  scrollOffset: number,
}) => void;

type ScrollEvent = SyntheticEvent<HTMLDivElement>;

export type Props = {|
  cellSize: CellSize,
  children: RenderFunction,
  className?: string,
  count: number,
  defaultScrollOffset?: number,
  direction: Direction,
  height: number | string,
  onItemsRendered?: onItemsRenderedCallback,
  onScroll?: onScrollCallback,
  overscanCount: number,
  style?: Object,
  useIsScrolling: boolean,
  width: number | string,
|};

type State = {|
  isScrolling: boolean,
  scrollDirection: ScrollDirection,
  scrollOffset: number,
|};

type GetCellOffset = (
  props: Props,
  index: number,
  instanceProps: any
) => number;
type GetCellSize = (props: Props, index: number, instanceProps: any) => number;
type GetEstimatedTotalSize = (props: Props, instanceProps: any) => number;
type GetOffsetForIndexAndAlignment = (
  props: Props,
  index: number,
  align: ScrollToAlign,
  scrollOffset: number,
  instanceProps: any
) => number;
type GetStartIndexForOffset = (
  props: Props,
  offset: number,
  instanceProps: any
) => number;
type GetStopIndexForStartIndex = (
  props: Props,
  startIndex: number,
  scrollOffset: number,
  instanceProps: any
) => number;
type InitInstanceProps = (props: Props, instance: any) => any;
type ValidateProps = (props: Props) => void;

const IS_SCROLLING_DEBOUNCE_INTERVAL = 150;

export default function createListComponent({
  getCellOffset,
  getCellSize,
  getEstimatedTotalSize,
  getOffsetForIndexAndAlignment,
  getStartIndexForOffset,
  getStopIndexForStartIndex,
  initInstanceProps,
  validateProps,
}: {|
  getCellOffset: GetCellOffset,
  getCellSize: GetCellSize,
  getEstimatedTotalSize: GetEstimatedTotalSize,
  getOffsetForIndexAndAlignment: GetOffsetForIndexAndAlignment,
  getStartIndexForOffset: GetStartIndexForOffset,
  getStopIndexForStartIndex: GetStopIndexForStartIndex,
  initInstanceProps: InitInstanceProps,
  validateProps: ValidateProps,
|}) {
  return class List extends React.Component<Props, State> {
    _cellStyleCache: { [index: number]: Object } = {};
    _instanceProps: any;
    _resetIsScrollingTimeoutId: TimeoutID | null = null;
    _scrollingContainer: ?HTMLDivElement;

    static defaultProps = {
      direction: 'vertical',
      overscanCount: 2,
      useIsScrolling: false,
    };

    state: State = {
      isScrolling: false,
      scrollDirection: 'forward',
      scrollOffset:
        typeof this.props.defaultScrollOffset === 'number'
          ? this.props.defaultScrollOffset
          : 0,
    };

    constructor(props: Props) {
      super(props);

      this._instanceProps = initInstanceProps(props, this);
    }

    static getDerivedStateFromProps(
      nextProps: Props,
      prevState: State
    ): $Shape<State> {
      validateSharedProps(nextProps);
      validateProps(nextProps);
      return null;
    }

    scrollTo(scrollOffset: number): void {
      if (this._scrollingContainer != null) {
        const { direction } = this.props;

        if (direction === 'horizontal') {
          ((this
            ._scrollingContainer: any): HTMLDivElement).scrollLeft = scrollOffset;
        } else {
          ((this
            ._scrollingContainer: any): HTMLDivElement).scrollTop = scrollOffset;
        }
      }

      if (process.env.NODE_ENV === 'test') {
        // Setting scroll offset doesn't fire the onScroll callback for react-test-renderer.
        // This test-only code makes it easier to test simualted scrolling behavior.
        // It should be stripped out of any non-test code.
        if (this.props.direction === 'horizontal') {
          this.onScrollHorizontal(
            ({ currentTarget: { scrollLeft: scrollOffset } }: any)
          );
        } else {
          this.onScrollVertical(
            ({ currentTarget: { scrollTop: scrollOffset } }: any)
          );
        }
      }
    }

    scrollToItem(index: number, align: ScrollToAlign = 'auto'): void {
      if (this._scrollingContainer != null || process.env.NODE_ENV === 'test') {
        const { scrollOffset } = this.state;
        this.scrollTo(
          getOffsetForIndexAndAlignment(
            this.props,
            index,
            align,
            scrollOffset,
            this._instanceProps
          )
        );
      }
    }

    componentDidMount() {
      const { defaultScrollOffset, direction } = this.props;

      if (typeof defaultScrollOffset === 'number') {
        if (this._scrollingContainer != null) {
          if (direction === 'horizontal') {
            ((this
              ._scrollingContainer: any): HTMLDivElement).scrollLeft = defaultScrollOffset;
          } else {
            ((this
              ._scrollingContainer: any): HTMLDivElement).scrollTop = defaultScrollOffset;
          }
        }
      }

      this.callPropsCallbacks();
    }

    componentDidUpdate() {
      this.callPropsCallbacks();
    }

    componentWillUnmount() {
      if (this._resetIsScrollingTimeoutId !== null) {
        clearTimeout(this._resetIsScrollingTimeoutId);
      }
    }

    render() {
      const { className, direction, height, style, width } = this.props;
      const { isScrolling } = this.state;

      const onScroll =
        direction === 'vertical'
          ? this.onScrollVertical
          : this.onScrollHorizontal;

      const estimatedTotalSize = getEstimatedTotalSize(
        this.props,
        this._instanceProps
      );

      return (
        <div
          className={className}
          ref={this.scrollingContainerRef}
          style={{
            position: 'relative',
            height,
            width,
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
            willChange: 'transform',
            ...style,
          }}
          onScroll={onScroll}
        >
          <div
            style={{
              height: direction === 'horizontal' ? height : estimatedTotalSize,
              overflow: 'hidden',
              pointerEvents: isScrolling ? 'none' : '',
              width: direction === 'horizontal' ? estimatedTotalSize : width,
            }}
          >
            {this.renderCells()}
          </div>
        </div>
      );
    }

    renderCells(): Array<React$Node> {
      const { children, direction, useIsScrolling } = this.props;
      const { isScrolling } = this.state;

      const [startIndex, stopIndex] = this.getRangeToRender();

      const cells = [];

      for (let index = startIndex; index <= stopIndex; index++) {
        const key = '' + index;

        // Cache cell styles while scrolling,
        // So that pure component sCU will prevent re-renders.
        let style;
        if (this._cellStyleCache.hasOwnProperty(index)) {
          style = this._cellStyleCache[index];
        } else {
          this._cellStyleCache[index] = style = {
            position: 'absolute',
            left:
              direction === 'horizontal'
                ? getCellOffset(this.props, index, this._instanceProps)
                : 0,
            top:
              direction === 'vertical'
                ? getCellOffset(this.props, index, this._instanceProps)
                : 0,
            height:
              direction === 'vertical'
                ? getCellSize(this.props, index, this._instanceProps)
                : '100%',
            width:
              direction === 'horizontal'
                ? getCellSize(this.props, index, this._instanceProps)
                : '100%',
          };
        }

        cells.push(
          children({
            key,
            index,
            isScrolling: useIsScrolling ? isScrolling : undefined,
            style,
          })
        );
      }

      return cells;
    }

    callOnItemsRendered: (
      overscanStartIndex: number,
      overscanStopIndex: number,
      visibleStartIndex: number,
      visibleStopIndex: number
    ) => void;
    callOnItemsRendered = memoizeOne(
      (
        overscanStartIndex: number,
        overscanStopIndex: number,
        visibleStartIndex: number,
        visibleStopIndex: number
      ) =>
        ((this.props.onItemsRendered: any): onItemsRenderedCallback)({
          overscanStartIndex,
          overscanStopIndex,
          visibleStartIndex,
          visibleStopIndex,
        })
    );

    callOnScroll: (
      scrollDirection: ScrollDirection,
      scrollOffset: number
    ) => void;
    callOnScroll = memoizeOne(
      (scrollDirection: ScrollDirection, scrollOffset: number) =>
        ((this.props.onScroll: any): onScrollCallback)({
          scrollDirection,
          scrollOffset,
        })
    );

    callPropsCallbacks() {
      if (typeof this.props.onItemsRendered === 'function') {
        const [
          overscanStartIndex,
          overscanStopIndex,
          visibleStartIndex,
          visibleStopIndex,
        ] = this.getRangeToRender();
        this.callOnItemsRendered(
          overscanStartIndex,
          overscanStopIndex,
          visibleStartIndex,
          visibleStopIndex
        );
      }

      if (typeof this.props.onScroll === 'function') {
        const { scrollDirection, scrollOffset } = this.state;
        this.callOnScroll(scrollDirection, scrollOffset);
      }
    }

    getRangeToRender(): [number, number, number, number] {
      const { count, overscanCount } = this.props;
      const { scrollDirection, scrollOffset } = this.state;

      const startIndex = getStartIndexForOffset(
        this.props,
        scrollOffset,
        this._instanceProps
      );
      const stopIndex = getStopIndexForStartIndex(
        this.props,
        startIndex,
        scrollOffset,
        this._instanceProps
      );

      // Overscan by one cell in each direction so that tab/focus works.
      // If there isn't at least one extra cell, tab loops back around.
      const overscanBackward =
        scrollDirection === 'backward' ? Math.max(1, overscanCount) : 1;
      const overscanForward =
        scrollDirection === 'forward' ? Math.max(1, overscanCount) : 1;

      return [
        Math.max(0, startIndex - overscanBackward),
        Math.min(count - 1, stopIndex + overscanForward),
        startIndex,
        stopIndex,
      ];
    }

    onScrollHorizontal = (event: ScrollEvent): void => {
      const { scrollLeft } = event.currentTarget;
      this.setState(
        prevState => ({
          isScrolling: true,
          scrollDirection:
            prevState.scrollOffset < scrollLeft ? 'forward' : 'backward',
          scrollOffset: scrollLeft,
        }),
        this.resetIsScrollingDebounced
      );
    };

    onScrollVertical = (event: ScrollEvent): void => {
      const { scrollTop } = event.currentTarget;
      this.setState(
        prevState => ({
          isScrolling: true,
          scrollDirection:
            prevState.scrollOffset < scrollTop ? 'forward' : 'backward',
          scrollOffset: scrollTop,
        }),
        this.resetIsScrollingDebounced
      );
    };

    scrollingContainerRef = (ref: any): void => {
      this._scrollingContainer = ((ref: any): HTMLDivElement);
    };

    resetIsScrollingDebounced = () => {
      if (this._resetIsScrollingTimeoutId !== null) {
        clearTimeout(this._resetIsScrollingTimeoutId);
      }

      this._resetIsScrollingTimeoutId = setTimeout(
        this.resetIsScrolling,
        IS_SCROLLING_DEBOUNCE_INTERVAL
      );
    };

    resetIsScrolling = () => {
      this._resetIsScrollingTimeoutId = null;

      this.setState({ isScrolling: false }, () => {
        // Clear style cache after state update has been committed.
        // This way we don't break pure sCU for cells that don't use isScrolling param.
        this._cellStyleCache = {};
      });
    };
  };
}

const validateSharedProps = ({
  children,
  direction,
  height,
  width,
}: Props): void => {
  if (process.env.NODE_ENV !== 'production') {
    if (direction !== 'horizontal' && direction !== 'vertical') {
      throw Error(
        'An invalid "direction" prop has been specified. ' +
          'Value should be either "horizontal" or "vertical". ' +
          `"${direction}" was specified.`
      );
    }

    if (typeof children !== 'function') {
      throw Error(
        'An invalid "children" prop has been specified. ' +
          'Value should be a function that creates a React element. ' +
          `"${children === null ? 'null' : typeof children}" was specified.`
      );
    }

    if (direction === 'horizontal' && typeof width !== 'number') {
      throw Error(
        'An invalid "width" prop has been specified. ' +
          'Horizontal lists must specify a number for width. ' +
          `"${width === null ? 'null' : typeof width}" was specified.`
      );
    } else if (direction === 'vertical' && typeof height !== 'number') {
      throw Error(
        'An invalid "height" prop has been specified. ' +
          'Vertical lists must specify a number for height. ' +
          `"${height === null ? 'null' : typeof height}" was specified.`
      );
    }
  }
};
