import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { FixedSizeList } from '..';

const findScrollContainer = rendered => rendered.root.children[0].children[0];

describe('FixedSizeList', () => {
  let cellRenderer, defaultProps;

  beforeEach(() => {
    jest.useFakeTimers();

    cellRenderer = jest.fn(({ key, style, ...rest }) => (
      <div key={key} style={style}>
        {JSON.stringify(rest, null, 2)}
      </div>
    ));
    defaultProps = {
      cellSize: 25,
      children: cellRenderer,
      count: 100,
      height: 100,
      width: 50,
    };
  });

  it('should render an empty list', () => {
    expect(
      ReactTestRenderer.create(<FixedSizeList {...defaultProps} count={0} />)
    ).toMatchSnapshot();
  });

  it('should render a list of rows', () => {
    expect(
      ReactTestRenderer.create(<FixedSizeList {...defaultProps} />)
    ).toMatchSnapshot();
  });

  it('should render a list of columns', () => {
    expect(
      ReactTestRenderer.create(
        <FixedSizeList {...defaultProps} direction="horizontal" />
      )
    ).toMatchSnapshot();
  });

  it('should support momentum scrolling on iOS devices', () => {
    const rendered = ReactTestRenderer.create(
      <FixedSizeList {...defaultProps} style={{ backgroundColor: 'red' }} />
    );
    expect(
      rendered.toJSON().props.style.WebkitOverflowScrolling
    ).toMatchSnapshot();
  });

  it('should disable pointer events while scrolling', () => {
    const rendered = ReactTestRenderer.create(
      <FixedSizeList {...defaultProps} />
    );
    const scrollContainer = findScrollContainer(rendered);
    expect(scrollContainer.props.style).toMatchSnapshot();
    rendered.getInstance().scrollTo(100);
    expect(scrollContainer.props.style).toMatchSnapshot();
    jest.runAllTimers();
    expect(scrollContainer.props.style).toMatchSnapshot();
  });

  describe('style overrides', () => {
    it('should support className prop', () => {
      const rendered = ReactTestRenderer.create(
        <FixedSizeList {...defaultProps} className="custom" />
      );
      expect(rendered.toJSON().props.className).toMatchSnapshot();
    });

    it('should support style prop', () => {
      const rendered = ReactTestRenderer.create(
        <FixedSizeList {...defaultProps} style={{ backgroundColor: 'red' }} />
      );
      expect(rendered.toJSON().props.style).toMatchSnapshot();
    });
  });

  describe('overscanCount', () => {
    it('should require a minimum of 1 overscan to support tabbing', () => {
      const onItemsRendered = jest.fn();
      ReactTestRenderer.create(
        <FixedSizeList
          {...defaultProps}
          defaultScrollOffset={50}
          onItemsRendered={onItemsRendered}
          overscanCount={0}
        />
      );
      expect(onItemsRendered.mock.calls).toMatchSnapshot();
    });

    it('should accommodate a custom overscan', () => {
      const onItemsRendered = jest.fn();
      ReactTestRenderer.create(
        <FixedSizeList
          {...defaultProps}
          defaultScrollOffset={50}
          onItemsRendered={onItemsRendered}
          overscanCount={2}
        />
      );
      expect(onItemsRendered.mock.calls).toMatchSnapshot();
    });

    it('should overscan in the direction being scrolled', () => {
      const onItemsRendered = jest.fn();
      const rendered = ReactTestRenderer.create(
        <FixedSizeList
          {...defaultProps}
          defaultScrollOffset={50}
          onItemsRendered={onItemsRendered}
          overscanCount={2}
        />
      );
      rendered.getInstance().scrollTo(100);
      rendered.getInstance().scrollTo(50);
      expect(onItemsRendered.mock.calls).toMatchSnapshot();
    });

    it('should not scan past the beginning of the list', () => {
      const onItemsRendered = jest.fn();
      ReactTestRenderer.create(
        <FixedSizeList
          {...defaultProps}
          defaultScrollOffset={0}
          onItemsRendered={onItemsRendered}
        />
      );
      expect(onItemsRendered.mock.calls).toMatchSnapshot();
    });

    it('should not scan past the end of the list', () => {
      const onItemsRendered = jest.fn();
      ReactTestRenderer.create(
        <FixedSizeList
          {...defaultProps}
          count={10}
          defaultScrollOffset={150}
          onItemsRendered={onItemsRendered}
        />
      );
      expect(onItemsRendered.mock.calls).toMatchSnapshot();
    });
  });

  describe('useIsScrolling', () => {
    it('should not pass an isScrolling param to children unless requested', () => {
      ReactTestRenderer.create(<FixedSizeList {...defaultProps} />);
      expect(cellRenderer.mock.calls[0]).toMatchSnapshot();
    });

    it('should pass an isScrolling param to children if requested', () => {
      ReactTestRenderer.create(
        <FixedSizeList {...defaultProps} useIsScrolling />
      );
      expect(cellRenderer.mock.calls[0]).toMatchSnapshot();
    });

    it('should update the isScrolling when scrolling starts and stops', () => {
      const rendered = ReactTestRenderer.create(
        <FixedSizeList {...defaultProps} useIsScrolling />
      );
      expect(cellRenderer.mock.calls[0]).toMatchSnapshot();
      cellRenderer.mockClear();
      rendered.getInstance().scrollTo(100);
      expect(cellRenderer.mock.calls[0]).toMatchSnapshot();
      cellRenderer.mockClear();
      jest.runAllTimers();
      expect(cellRenderer.mock.calls[0]).toMatchSnapshot();
    });
  });

  describe('scrollTo method', () => {
    it('should scroll to the offset specified', () => {
      const onItemsRendered = jest.fn();
      const rendered = ReactTestRenderer.create(
        <FixedSizeList {...defaultProps} onItemsRendered={onItemsRendered} />
      );
      rendered.getInstance().scrollTo(100);
      rendered.getInstance().scrollTo(0);
      expect(onItemsRendered.mock.calls).toMatchSnapshot();
    });
  });

  describe('scrollToItem method', () => {
    it('should scroll to the correct item for align = "auto"', () => {
      const onItemsRendered = jest.fn();
      const rendered = ReactTestRenderer.create(
        <FixedSizeList {...defaultProps} onItemsRendered={onItemsRendered} />
      );
      // Scroll down enough to show item 10 at the bottom.
      rendered.getInstance().scrollToItem(10, 'auto');
      // No need to scroll again; item 9 is already visible.
      // Overscan indices will change though, since direction changes.
      rendered.getInstance().scrollToItem(9, 'auto');
      // Scroll up enough to show item 2 at the top.
      rendered.getInstance().scrollToItem(2, 'auto');
      expect(onItemsRendered.mock.calls).toMatchSnapshot();
    });

    it('should scroll to the correct item for align = "start"', () => {
      const onItemsRendered = jest.fn();
      const rendered = ReactTestRenderer.create(
        <FixedSizeList {...defaultProps} onItemsRendered={onItemsRendered} />
      );
      // Scroll down enough to show item 10 at the top.
      rendered.getInstance().scrollToItem(10, 'start');
      // Scroll back up so that item 9 is at the top.
      // Overscroll direction wil change too.
      rendered.getInstance().scrollToItem(9, 'start');
      // Item 99 can't align at the top because there aren't enough items.
      // Scroll down as far as possible though.
      // Overscroll direction wil change again.
      rendered.getInstance().scrollToItem(99, 'start');
      expect(onItemsRendered.mock.calls).toMatchSnapshot();
    });

    it('should scroll to the correct item for align = "end"', () => {
      const onItemsRendered = jest.fn();
      const rendered = ReactTestRenderer.create(
        <FixedSizeList {...defaultProps} onItemsRendered={onItemsRendered} />
      );
      // Scroll down enough to show item 10 at the bottom.
      rendered.getInstance().scrollToItem(10, 'end');
      // Scroll back up so that item 9 is at the bottom.
      // Overscroll direction wil change too.
      rendered.getInstance().scrollToItem(9, 'end');
      // Item 1 can't align at the bottom because it's too close to the beginning.
      // Scroll up as far as possible though.
      // Overscroll direction wil change again.
      rendered.getInstance().scrollToItem(1, 'end');
      expect(onItemsRendered.mock.calls).toMatchSnapshot();
    });

    it('should scroll to the correct item for align = "center"', () => {
      const onItemsRendered = jest.fn();
      const rendered = ReactTestRenderer.create(
        <FixedSizeList {...defaultProps} onItemsRendered={onItemsRendered} />
      );
      // Scroll down enough to show item 10 in the middle.
      rendered.getInstance().scrollToItem(10, 'center');
      // Scroll back up so that item 9 is in the middle.
      // Overscroll direction wil change too.
      rendered.getInstance().scrollToItem(9, 'center');
      // Item 1 can't align in the middle because it's too close to the beginning.
      // Scroll up as far as possible though.
      // Overscroll direction wil change again.
      rendered.getInstance().scrollToItem(1, 'center');
      // Item 99 can't align in the middle because it's too close to the end.
      // Scroll down as far as possible though.
      // Overscroll direction wil change again.
      rendered.getInstance().scrollToItem(99, 'center');
      expect(onItemsRendered.mock.calls).toMatchSnapshot();
    });
  });

  describe('callback props', () => {
    // onItemsRendered is pretty well covered by other snapshot tests

    it('should call onScroll when scroll position changes', () => {
      const onScroll = jest.fn();
      const rendered = ReactTestRenderer.create(
        <FixedSizeList {...defaultProps} onScroll={onScroll} />
      );
      rendered.getInstance().scrollTo(100);
      rendered.getInstance().scrollTo(0);
      expect(onScroll.mock.calls).toMatchSnapshot();
    });
  });

  describe('props validation', () => {
    beforeEach(() => spyOn(console, 'error'));

    it('should fail if non-numeric cellSize is provided', () => {
      expect(() =>
        ReactTestRenderer.create(
          <FixedSizeList {...defaultProps} cellSize="abc" />
        )
      ).toThrow(
        'An invalid "cellSize" prop has been specified. Value should be a number. "string" was specified.'
      );
    });

    it('should fail if no children function is provided', () => {
      expect(() =>
        ReactTestRenderer.create(
          <FixedSizeList {...defaultProps} children={undefined} />
        )
      ).toThrow(
        'An invalid "children" prop has been specified. Value should be a function that creates a React element. "undefined" was specified.'
      );
    });

    it('should fail if an invalid direction is provided', () => {
      expect(() =>
        ReactTestRenderer.create(
          <FixedSizeList {...defaultProps} direction={null} />
        )
      ).toThrow(
        'An invalid "direction" prop has been specified. Value should be either "horizontal" or "vertical". "null" was specified.'
      );
    });

    it('should fail if a string height is provided for a vertical list', () => {
      expect(() =>
        ReactTestRenderer.create(
          <FixedSizeList {...defaultProps} direction="vertical" height="100%" />
        )
      ).toThrow(
        'An invalid "height" prop has been specified. Vertical lists must specify a number for height. "string" was specified.'
      );
    });

    it('should fail if a string width is provided for a horizontal list', () => {
      expect(() =>
        ReactTestRenderer.create(
          <FixedSizeList
            {...defaultProps}
            direction="horizontal"
            width="100%"
          />
        )
      ).toThrow(
        'An invalid "width" prop has been specified. Horizontal lists must specify a number for width. "string" was specified.'
      );
    });
  });
});
