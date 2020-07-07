SpatialHash
===========

Spatial hashing for 2D shapes.

Example
-------

Using `PointHash`:

    const cellSize = 10,
		ptHash = new PointHash(cellSize); // store points in grid cells of 10x10
	
	ptHash.addPoint(12, 14, "foo") // store a point at (12, 14) with value "foo"
		.addPoint(5, 13, "bar") // addPoint is chainable
		.addPoint(18, 19, "baz")
		.addPoint(6, 7, "quux")
		.addPoint(18, 9, "alpha")
		.addPoint(5, 21, "bravo")
		.addPoint(20, 16, "charlie")
		.addPoint(21, 19, "delta");
	
	ptHash.findPoint(5, 13); // = [5, 13, "bar"] finds point exactly
	ptHash.findPoint(18, 20); // = undefined
	
	// find points within a radius of 4 around (20, 18)
	for(const [x, y, name] of ptHash.nearbyPoints(20, 18, 4)){
		// yields [20, 16, "charlie"]
		//        [18, 19, "baz"]
		//        [21, 19, "delta"]
		// though not necessarily in that order
	}
	
	// find points within 2 units around line segment (4, 22) - (19, 8)
	for(const [x, y, name] of ptHash.pointsNearSegment(4, 22, 19, 8, 2)){
		// yields [ 5, 21, "bravo"]
		//        [12, 14, "foo"]
		//        [18,  9, "alpha"]
		// though not necessarily in that order
	}

Using `SegmentHash`:
	
	const cellSize = 10,
		sgHash = new SegmentHash(cellSize); // store segments in cells of 10x10
	
	sgHash.addSegment(7, 7, 9, 28, "foo") // add segment (7, 7) to (9, 28) with value "foo"
		.addSegment(16, 9, 15, 26, "bar")
		.addSegment(19, 6, 26, 25, "quux");
	
	sgHash.findSegment(7, 7, 9, 28); // = [7, 7, 9, 28, "foo"] find segment exactly
	sgHash.findSegment(15, 9, 15, 26); // = undefined
	
	// find the two segments that intersect with (11, 19) to (25, 16)
	for(const [x1, y1, x2, y2, name] of sgHash.findIntersects(11, 19, 25, 16)){
		// yields [16, 9, 15, 26, "bar"]
		//        [19, 6, 26, 25, "quux"]
		// though not necessarily in that order, and some segments possibly more
		// than once
	}

Install
-------

Install from NPM:

	npm install @kninnug/spatialhash
	
Use in Node.js:

	const {PointHash, SegmentHash} = require('@kninnug/spatialhash');
	
or as an ECMAScript/ES6 module:

	import {PointHash, SegmentHash} from '@kninnug/spatialhash';

or in the browser:

	<script src="node_modules/@kninnug/spatialhash/SpatialHash.js"></script>

or minified:

	<script src="node_modules/@kninnug/spatialhash/SpatialHash.min.js"></script>

Details
-------

A spatial hash stores shapes (in the case of this library, 2D points and line
segments), in a way that makes finding duplicates and nearby shapes fast. It
does this by storing the shapes in a sparse grid. When searching for nearby
shapes, it only needs to look at the grid cells around the shape to find, rather
than having to compare against every shape stored in the hash.

The size of the grid cells is determined by the `cellSize` parameter to the
constructors. The value depends entirely on your application, and will require
fine-tuning. If the grid cells are too large, there will be many shapes per grid
cell which all need to be considered when searching, and the performance will be
no better than using a plain array. On the other hand, if the grid cells are too
small, the shapes will occupy many grid cells which all incur a memory overhead.

The `SpatialHash` stores the grid as a plain JavaScript object, where the keys
are the coordinates of the top-left corner of the grid-cell, divided by the cell
size, and the values are arrays.

`PointHash` stores the `[x0, y0, value0, x1, y1, value1, ...]` of the points in
the grid cell arrays. `SegmentHash` stores `[x1, y1, x2, y2, value, ...]` of the
segments in the grid cell arrays. These are 'flat' arrays to reduce memory
overhead.

API reference
-------------

### SpatialHash(cellSize)

Both `PointHash` and `SegmentHash` extend `SpatialHash`, so its methods are
available on instances of both those classes. `SpatialHash` itself does not
offer much useful functionality, and is effectively an abstract base class.

The `cellSize` parameter determines the width & height of the grid cells.

#### SpatialHash#cellsUnderExtent(x, y, width, height)

Yield the grid cells that are covered by the given axis-aligned bounding-box.
The `[cellX, cellY]` are the coordinates of the top-left corner of the grid
cell, divided by the cell size. I.e. with `cellSize = 20`, `[2, 3]` is the cell
from (40, 60) to (60, 80).

#### SpatialHash#cellsUnderSegment(x1, y1, x2, y2, eps)

Yield the grid cells `[cellX, cellY]` that are covered by the given line segment
with a thickness of `eps`. This thickness should not be greater than the
`cellSize`. Or rather, cells beyond that distance will not be found.

### ptHash = new PointHash(cellSize)

Create a new spatial hash for storing 2D points.

#### ptHash.addPoint(x, y, value)

Add a point with the given (`x`, `y`) coordinates and an arbitrary value. You
can add multiple points with the same coordinates, but they may not be found by
the other methods. The point-hash works best when all points have distinct 
coordinates. Returns `ptHash`.

#### ptHash.findPoint(x, y)

Find the point with the exact given coordinates. Returns either `undefined` if
there is no point with those coordinates, or the `[x, y, value]` that the point
was stored with via `addPoint`. Note that this compares the `x` and `y` by
`===`. If you need to find (a) point(s) by approximate coordinates, use 
`nearbyPoints`.

#### ptHash.removePoint(x, y)

Remove the point with the exact given coordinates. Returns either `undefined` if
there was not point with those coordinates, or the `[x, y, value]` that the
point was stored with. If multiple points with the exact given coordinates were
stored, only one will be removed.

#### ptHash.nearbyPoints(cx, cy, r)

Find points within a certain distance from the given (`cx`, `cy`) coordinates.
I.e. the points in the hash covered by the circle centered at (`cx`, `cy`) with
radius `r`. Yields arrays of `[x, y, value, dist2]` where `dist2` is the
distance squared between (`cx`, `cy`) and (`x`, `y`).

#### ptHash.pointsNearSegment(x1, y1, x2, y2, eps)

Find points within a certain distance from the line segment (`x1`, `y1`) to 
(`x2`, `y2`). The distance to the segment, `eps`, should not be greater than
`ptHash.cellSize`. Or rather, points beyond that distance will simply not be
found. Yields arrays of `[x, y, value, dist2]` where `dist2` is the distance
squared between (`x`, `y`) and the nearest point to that point on the segment.

### sgHash = new SegmentHash(cellSize)

Create a new spatial hash for storing 2D line segments.

#### sgHash.addSegment(x1, y1, x2, y2, value)

Add a line segment with the given end-point coordinates (`x1`, `y1`) to (`x2`,
`y2`) and an arbitrary value. You can add multiple line segments with the same
coordinates, but they may not be found by the other methods. Returns `sgHash`.

#### sgHash.findSegment(x1, y1, x2, y2)

Find the segment with the given (`x1`, `y1`) to (`x2`, `y2`) coordinates.
Returns either `undefined` if there is no segment with those coordinates in the
hash, or the `[x1, y1, x2, y2, value]` that the segment was stored with.

#### sgHash.removeSegment(x1, y1, x2, y2)

Remove the segment with the given (`x1`, `y1`) to (`x2`, `y2`) coordinates. 
Returns either `undefined` or the `[x1, y1, x2, y2, value]` that the segment was
stored with. If multiple segments with the exact given coordinates were stored,
only one will be removed.

#### sgHash.findIntersects(x1, y1, x2, y2, eps)

Find the segments in the hash that intersect with the given segment. Yields the
`[x1, y1, x2, y2, value]` of the intersecting segments. Note that the order in
which the segments are yielded is not guaranteed, and segments may be yielded
more than once.

TODO
----

- Fix duplicates from `SegmentHash#findIntersects`.
- Add spatial hash for triangles.
- Add spatial hashes for rectangles, circles?
- 3D?

Attributions
------------

- Segment/segment intersection code adapted from [Gareth Rees on StackOverflow](https://stackoverflow.com/a/565282).
- Nearest point on segment code adapted from [Joshua on StackOverflow](https://stackoverflow.com/a/6853926).
