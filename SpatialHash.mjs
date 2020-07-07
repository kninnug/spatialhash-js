/**
 * Find the given sequence of values in the given array.
 *
 * @param {array} arr The array to search in.
 * @param {number} stride The number of elements per sub-sequence in the array.
 * @param {any} args The sub-sequence to find.
 * @return {number} The index where the values were found, or -1.
 */
function findSubArray(arr, stride, ...args){
	for(let i = 0; i < arr.length; i += stride){
		let found = 0;
		for(let j = 0; j < args.length; j++){
			if(args[j] !== arr[i + j]){
				break;
			}
			found++;
		}
		
		if(found === args.length){
			return i;
		}
	}
	
	return -1;
}

/**
 * A spatial hash.
 */
class SpatialHash {
	/**
	 * Make a spatial hash.
	 *
	 * @param {number} numElements Number of array elements per shape.
	 * @param {number} cellSize The size of the grid cells.
	 */
	constructor(numElements, cellSize){
		this.numElements = numElements;
		this.cellSize = cellSize;
		this.map = {};
	}
	
	/**
	 * Add a shape to the given cell.
	 *
	 * @param {number} cellX The grid cell x coordinate.
	 * @param {number} cellY The grid cell y coordinate.
	 * @param {any} args The data to add to the cell.
	 * @return this.
	 */
	addAt(cellX, cellY, ...args){
		const key = cellX + ',' + cellY,
			arr = this.map[key] || [];
		
		arr.push(...args);
		this.map[key] = arr;
		
		return this;
	}
	
	/**
	 * Find the index in the cell array where the given values start.
	 *
	 * @param {number} cellX The grid cell x coordinate.
	 * @param {number} cellY The grid cell y coordinate.
	 * @param {any} args The values to find.
	 * @return {number} The starting index, or -1.
	 */
	findIndex(cellX, cellY, ...args){
		const key = cellX + ',' + cellY,
			arr = this.map[key];
		
		if(!arr){
			return -1;
		}
		
		return findSubArray(arr, this.numElements, ...args);
	}
	
	/**
	 * Find the given sequence of values, and the values that are stored along
	 * with it.
	 *
	 * @param {number} cellX The grid cell x coordinate.
	 * @param {number} cellY The grid cell y coordinate.
	 * @param {any} args The values to find.
	 * @return {array} The found values, or undefined.
	 */
	findValues(cellX, cellY, ...args){
		const key = cellX + ',' + cellY,
			arr = this.map[key];
		
		if(!arr){
			return undefined;
		}
		
		const idx = findSubArray(arr, this.numElements, ...args);
		
		if(idx === -1){
			return undefined;
		}
		
		return arr.slice(idx, idx + this.numElements);
	}
	
	/**
	 * Remove the shape at the given index in the given grid cell.
	 *
	 * @param {number} cellX The grid cell x coordinate.
	 * @param {number} cellY The grid cell y coordinate.
	 * @param {number} idx The index in the grid cell array.
	 * @return {array} An array with the removed data, or an empty array if
	 *         there was nothing to remove.
	 */
	removeAt(cellX, cellY, idx){
		const key = cellX + ',' + cellY,
			arr = this.map[key];
		
		if(!arr){
			return [];
		}
		
		const ret = arr.splice(idx, this.numElements);
		if(!arr.length){
			delete this.map[key];
		}
		
		return ret;
	}
	
	/**
	 * Find grid cells covered by a given axis-aligned bounding box.
	 *
	 * @param {number} x The x-coordinate of the top-left corner.
	 * @param {number} y The y-coordinate of the top-left corner.
	 * @param {number} width The width of the box.
	 * @param {number} height The height of the box.
	 * @yield {array} The [x, y] grid cell coordinates.
	 */
	*cellsUnderExtent(x, y, width, height){
		const sz = this.cellSize,
			startX = (x / sz) | 0,
			startY = (y / sz) | 0,
			endX = (((x + width) / sz) | 0) + 1,
			endY = (((y + height) / sz) | 0) + 1;
		
		for(let cellY = startY; cellY < endY; cellY++){
			for(let cellX = startX; cellX < endX; cellX++){
				yield [cellX, cellY];
			}
		}
	}
	
	/**
	 * Find grid cells covered by a given line segment.
	 *
	 * @param {number} x1 The point 1 x-coordinate of the segment.
	 * @param {number} y1 The point 1 y-coordinate of the segment.
	 * @param {number} x2 The point 2 x-coordinate of the segment.
	 * @param {number} y2 The point 2 y-coordinate of the segment.
	 * @param {number} eps The width of the segment/maximum distance from the
	 *        segment to search in. Should not be greater than `this.cellSize`.
	 * @yield {array} The [x, y] grid cell coordinates.
	 */
	*cellsUnderSegment(x1, y1, x2, y2, eps = this.cellSize / 2){
		const sz = this.cellSize,
			dx = x2 - x1,
			dy = y2 - y1,
			dirX = Math.sign(dx),
			dirY = Math.sign(dy),
			dydx = Math.abs(dy / dx),
			dxdy = Math.abs(dx / dy),
			startCellX = (x1 / sz) | 0,
			startCellY = (y1 / sz) | 0,
			endCellX = (x2 / sz) | 0,
			endCellY = (y2 / sz) | 0,
			steps = Math.abs(endCellX - startCellX) + Math.abs(endCellY - startCellY),
			seen = new Set;
		
		let x = x1,
			y = y1,
			cellX = startCellX,
			cellY = startCellY,
			iter = 0;
		
		const canEmit = (x, y) => {
			const key = x + ',' + y,
				ret = seen.has(key);
			seen.add(key);
			return !ret;
		};
		
		while((cellX !== endCellX || cellY !== endCellY) && iter <= steps){
			const lft = x - cellX * sz,
				rgt = (cellX + 1) * sz - x,
				distX = (dirX < 0) ? lft : rgt,
				top = y - cellY * sz,
				bot = (cellY + 1) * sz - y,
				distY = (dirY < 0) ? top : bot,
				horX = distX,
				horY = distX * dydx,
				verX = distY * dxdy,
				verY = distY,
				hor = horX*horX + horY*horY,
				ver = verX*verX + verY*verY;
			
			if(lft <= eps){
				if(canEmit(cellX - 1, cellY)){ yield [cellX - 1, cellY]; }
				if(top <= eps){
					if(canEmit(cellX - 1, cellY - 1)){ yield [cellX - 1, cellY - 1]; }
				}
				if(bot <= eps){
					if(canEmit(cellX - 1, cellY + 1)){ yield [cellX - 1, cellY + 1]; }
				}
			}
			if(rgt <= eps){
				if(canEmit(cellX + 1, cellY)){ yield [cellX + 1, cellY]; }
				if(top <= eps){
					if(canEmit(cellX + 1, cellY - 1)){ yield [cellX + 1, cellY - 1]; }
				}
				if(bot <= eps){
					if(canEmit(cellX + 1, cellY + 1)){ yield [cellX + 1, cellY + 1]; }
				}
			}
			if(top <= eps){
				if(canEmit(cellX, cellY - 1)){ yield [cellX, cellY - 1]; }
			}
			if(bot <= eps){
				if(canEmit(cellX, cellY + 1)){ yield [cellX, cellY + 1]; }
			}
			
			if(canEmit(cellX, cellY)){ yield [cellX, cellY]; }
			
			if(hor < ver){ // move in x
				x = x + horX * dirX;
				y = y + horY * dirY;
				cellX = cellX + dirX;
			}else{ // move in y
				x = x + verX * dirX;
				y = y + verY * dirY;
				cellY = cellY + dirY;
			}
			
			iter++;
		}
		
		cellX = endCellX;
		cellY = endCellY;
		const lft = x2 - cellX * sz,
			rgt = (cellX + 1) * sz - x2,
			top = y2 - cellY * sz,
			bot = (cellY + 1) * sz - y2;
		
		if(lft <= eps){
			if(canEmit(cellX - 1, cellY)){ yield [cellX - 1, cellY]; }
			if(top <= eps){
				if(canEmit(cellX - 1, cellY - 1)){ yield [cellX - 1, cellY - 1]; }
			}
			if(bot <= eps){
				if(canEmit(cellX - 1, cellY + 1)){ yield [cellX - 1, cellY + 1]; }
			}
		}
		if(rgt <= eps){
			if(canEmit(cellX + 1, cellY)){ yield [cellX + 1, cellY]; }
			if(top <= eps){
				if(canEmit(cellX + 1, cellY - 1)){ yield [cellX + 1, cellY - 1]; }
			}
			if(bot <= eps){
				if(canEmit(cellX + 1, cellY + 1)){ yield [cellX + 1, cellY + 1]; }
			}
		}
		if(top <= eps){
			if(canEmit(cellX, cellY - 1)){ yield [cellX, cellY - 1]; }
		}
		if(bot <= eps){
			if(canEmit(cellX, cellY + 1)){ yield [cellX, cellY + 1]; }
		}
		
		if(canEmit(cellX, cellY)){ yield [cellX, cellY]; }
	}
}

/**
 * A spatial hash for storing 2D points.
 */
class PointHash extends SpatialHash {
	/**
	 * Make a point hash.
	 *
	 * @param {number} cellSize The size of the grid cells.
	 */
	constructor(cellSize){
		super(3, cellSize);
	}
	
	/**
	 * Add a point with a value to associate. Note that this does not check for
	 * duplicates.
	 *
	 * @param {number} x The x-coordinate.
	 * @param {number} y The y-coordinate.
	 * @param {any} val A value to store with the point.
	 * @return {PointHash} this.
	 */
	addPoint(x, y, val){
		const sz = this.cellSize;
		return this.addAt((x / sz) | 0, (y / sz) | 0, x, y, val);
	}
	
	/**
	 * Find the point with the given coordinates, if it is in the hash. Note
	 * that this tests for strict equality on the coordinates.
	 *
	 * @param {number} x The x-coordinate.
	 * @param {number} y The y-coordinate.
	 * @return {array|undefined} An array with the [x, y, value] that the point
	 *         was stored with, or `undefined`.
	 */
	findPoint(x, y){
		const sz = this.cellSize,
			cx = (x / sz) | 0,
			cy = (y / sz) | 0;
		
		return this.findValues(cx, cy, x, y);
	}
	
	/**
	 * Remove the point with the given coordinates from the hash.
	 *
	 * @param {number} x The x coordinate.
	 * @param {number} y The y coordinate.
	 * @return {array|undefined} An array with the removed [x, y, value], or
	 *         undefined if there was no point to remove.
	 */
	removePoint(x, y){
		const sz = this.cellSize,
			cx = (x / sz) | 0,
			cy = (y / sz) | 0,
			idx = this.findIndex(cx, cy, x, y);
		
		if(idx === -1){
			return undefined;
		}
		
		return this.removeAt(cx, cy, idx);
	}
	
	/**
	 * Find points within a given radius from a given point.
	 *
	 * @param {number} cx The center x-coordinate.
	 * @param {number} cy The center y-coordinate.
	 * @param {number} r The radius to search within.
	 * @yield {array} An array with [x, y, value, dist²] of any point within the
	 *        given radius.
	 */
	*nearbyPoints(cx, cy, r){
		const d = r + r,
			r2 = r * r;
		for(const [cellX, cellY] of this.cellsUnderExtent(cx - r, cy - r, d, d)){
			const key = cellX + ',' + cellY,
				arr = this.map[key];
			
			if(!arr){
				continue;
			}
			
			for(let i = 0; i < arr.length; i += 3){
				const px = arr[i],
					py = arr[i + 1],
					pv = arr[i + 2],
					d2 = sqdist(cx, cy, px, py);
				
				if(d2 <= r2){
					yield [px, py, pv, d2];
				}
			}
		}
	}
	
	/**
	 * Find points on or near a given line segment.
	 *
	 * @param {number} x1 The point 1 x-coordinate of the segment.
	 * @param {number} y1 The point 1 y-coordinate of the segment.
	 * @param {number} x2 The point 2 x-coordinate of the segment.
	 * @param {number} y2 The point 2 y-coordinate of the segment.
	 * @param {number} eps The width of the segment/maximum distance from the
	 *        segment to search in. Should not be greater than `this.cellSize`.
	 * @yield {array} The [x, y, value] of the points near the segment.
	 */
	*pointsNearSegment(x1, y1, x2, y2, eps = this.cellSize / 2){
		const eps2 = eps * eps;
		for(const [x, y] of this.cellsUnderSegment(x1, y1, x2, y2, eps)){
			const key = x + ',' + y,
				arr = this.map[key];
			
			if(!arr){
				continue;
			}
			
			for(let i = 0; i < arr.length; i += 3){
				const px = arr[i],
					py = arr[i + 1],
					pv = arr[i + 2],
					d2 = segPointDistSq(x1, y1, x2, y2, px, py);
				
				if(d2 <= eps2){
					yield [px, py, pv, d2];
				}
			}
		}
	}
}

/**
 * Squared distance between two points.
 *
 * @param {number} ax Point a x-coordinate.
 * @param {number} ay Point a y-coordinate.
 * @param {number} bx Point b x-coordinate.
 * @param {number} by Point b y-coordinate.
 * @return {number} The squared distance.
 */
function sqdist(ax, ay, bx, by){
	const dx = ax - bx,
		dy = ay - by;
	return dx * dx + dy * dy;
}

/**
 * Distance between a point and the nearest point to it on a segment, squared.
 *
 * @source https://stackoverflow.com/a/6853926
 * @param {number} x1 The segment point 1 x-coordinate.
 * @param {number} y1 The segment point 1 y-coordinate.
 * @param {number} x2 The segment point 2 x-coordinate.
 * @param {number} y2 The segment point 2 y-coordinate.
 * @param {number} x The point x-coordinate.
 * @param {number} y The point y-coordinate.
 * @return {number} The distance squared.
 */
function segPointDistSq(x1, y1, x2, y2, x, y){
	const A = x - x1,
		B = y - y1,
		C = x2 - x1,
		D = y2 - y1,

		dot = A * C + B * D,
		lenSq = C * C + D * D,
		param = lenSq === 0 ? -1 : dot / lenSq;

	let xx, yy;

	if(param < 0){
		xx = x1;
		yy = y1;
	}else if(param > 1){
		xx = x2;
		yy = y2;
	}else{
		xx = x1 + param * C;
		yy = y1 + param * D;
	}

	const dx = x - xx,
		dy = y - yy;
	return dx * dx + dy * dy;
}

/**
 * A spatial hash for storing line segments.
 */
class SegmentHash extends SpatialHash {
	/**
	 * Make a segment hash.
	 *
	 * @param {number} cellSize The size of the grid cells.
	 */
	constructor(cellSize){
		super(5, cellSize);
	}
	
	/**
	 * Add a segment to the hash.
	 *
	 * @param {number} x1 The point 1 x-coordinate of the segment.
	 * @param {number} y1 The point 1 y-coordinate of the segment.
	 * @param {number} x2 The point 2 x-coordinate of the segment.
	 * @param {number} y2 The point 2 y-coordinate of the segment.
	 * @param {any} val A value to store with the segment.
	 * @return {SegmentHash} this.
	 */
	addSegment(x1, y1, x2, y2, val){
		for(const [cellX, cellY] of this.cellsUnderSegment(x1, y1, x2, y2)){
			this.addAt(cellX, cellY, x1, y1, x2, y2, val);
		}
		
		return this;
	}
	
	/**
	 * Find a segment in the hash.
	 *
	 * @param {number} x1 The point 1 x-coordinate of the segment.
	 * @param {number} y1 The point 1 y-coordinate of the segment.
	 * @param {number} x2 The point 2 x-coordinate of the segment.
	 * @param {number} y2 The point 2 y-coordinate of the segment.
	 * @return {array|undefined} The [x1, y1, x2, y2, val] of the segment, or
	 *         undefined.
	 */
	findSegment(x1, y1, x2, y2){
		const sz = this.cellSize,
			cx = (x1 / sz) | 0,
			cy = (y1 / sz) | 0;
		
		return this.findValues(cx, cy, x1, y1, x2, y2);
	}
	
	/**
	 * Remove a segment from the hash.
	 *
	 * @param {number} x1 The point 1 x-coordinate of the segment.
	 * @param {number} y1 The point 1 y-coordinate of the segment.
	 * @param {number} x2 The point 2 x-coordinate of the segment.
	 * @param {number} y2 The point 2 y-coordinate of the segment.
	 * @return {array|undefined} The [x1, y1, x2, y2, val] of the segment, or
	 *         undefined.
	 */
	removeSegment(x1, y1, x2, y2){
		let val = undefined;
		for(const [cellX, cellY] of this.cellsUnderSegment(x1, y1, x2, y2)){
			const idx = this.findIndex(cellX, cellY, x1, y1, x2, y2);
		
			if(idx === -1){ // can't find it once: can't find it ever
				return undefined;
			}
			
			val = this.removeAt(cellX, cellY, idx)[4];
		}
		
		return [x1, y1, x2, y2, val];
	}
	
	/**
	 * Find the segments that intersect the given segment in the hash.
	 *
	 * @param {number} x1 The point 1 x-coordinate of the segment.
	 * @param {number} y1 The point 1 y-coordinate of the segment.
	 * @param {number} x2 The point 2 x-coordinate of the segment.
	 * @param {number} y2 The point 2 y-coordinate of the segment.
	 * @param {number} eps The width of the segment/maximum distance from the
	 *        segment to search in. Should not be greater than `this.cellSize`.
	 * @yield {array} The [x1, y1, x2, y2, val] of the intersecting segments.
	 */
	*findIntersects(x1, y1, x2, y2, eps = 1){
		let prev = null;
		for(const [cellX, cellY] of this.cellsUnderSegment(x1, y1, x2, y2, eps)){
			const key = cellX + ',' + cellY,
				arr = this.map[key];
			
			if(!arr){
				continue;
			}
			
			for(let i = 0; i < arr.length; i += 5){
				const sx1 = arr[i],
					sy1 = arr[i + 1],
					sx2 = arr[i + 2],
					sy2 = arr[i + 3],
					sv = arr[i + 4];
				
				if(prev && prev[0] === sx1 && prev[1] === sy1 && prev[2] === sx2 && prev[3] === sy2){
					continue;
				}
			
				if(intersectSegments(x1, y1, x2, y2, sx1, sy1, sx2, sy2)){
					yield [sx1, sy1, sx2, sy2, sv];
					prev = [sx1, sy1, sx2, sy2];
				}
			}
		}
	}
}

/**
 * Compute if two line segments [p1, p2] and [p3, p4] intersect.
 *
 * @name Constrainautor.intersectSegments
 * @source https://stackoverflow.com/a/565282
 * @param {number} p1x The x coordinate of point 1 of the first segment.
 * @param {number} p1y The y coordinate of point 1 of the first segment.
 * @param {number} p2x The x coordinate of point 2 of the first segment.
 * @param {number} p2y The y coordinate of point 2 of the first segment.
 * @param {number} p3x The x coordinate of point 1 of the second segment.
 * @param {number} p3y The y coordinate of point 1 of the second segment.
 * @param {number} p4x The x coordinate of point 2 of the second segment.
 * @param {number} p4y The y coordinate of point 2 of the second segment.
 * @return {boolean} True if the line segments intersect.
 */
function intersectSegments(p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y){
	const rx = p2x - p1x,
		ry = p2y - p1y,
		sx = p4x - p3x,
		sy = p4y - p3y,
		mx = p3x - p1x,
		my = p3y - p1y,
		n = mx * ry - rx * my,
		d = rx * sy - sx * ry;
	
	if(d === 0.0){
		// collinear
		if(n === 0.0){
			const rr = rx * rx + ry * ry,
				t0 = (mx * rx + my * ry) / rr,
				t1 = t0 + (sx * rx + sy * ry) / rr;
			
			if(!((t0 < 0 && t1 < 0) || (t0 > 1 && t1 > 1))){
				// collinear & overlapping
				return true;
			}
		}
		
		return false;
	}
	
	const u = n / d,
		t = (mx * sy - sx * my) / d;
	
	if(t < 0.0 || t > 1.0 || u < 0.0 || u > 1.0){
		return false;
	}
	
	return true;
}

export {SpatialHash, PointHash, SegmentHash, intersectSegments, segPointDistSq};
