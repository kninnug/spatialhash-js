import {PointHash, segPointDistSq} from './SpatialHash.mjs';
import util from 'util';
import tape from 'tape';

function sqdist(ax, ay, bx, by){
	const dx = ax - bx,
		dy = ay - by;
	return dx * dx + dy * dy;
}

function occupancy(hash){
	let activeCells = 0,
		empty = 0,
		points = 0,
		min = Infinity,
		max = -Infinity;
	
	for(const [key, arr] of Object.entries(hash.map)){
		if(!arr || !arr.length){
			empty++;
			continue;
		}
		
		activeCells++;
		const len = arr.length / 3;
		min = Math.min(min, len);
		max = Math.max(max, len);
		points += len;
	}
	
	return {
		min,
		max,
		activeCells,
		points,
		mean: points / activeCells
	}
}

function genRandom(hash, count, scale){
	const points = [];
	
	for(let i = 0; i < count; i++){
		const x = Math.random() * scale,
			y = Math.random() * scale,
			idx = points.length;
		
		hash.addPoint(x, y, idx);
		points.push(x, y);
	}
	
	return {hash, points};
}

function genGrid(hash, scale, w, h, offX = 0, offY = 0){
	const points = [];
	
	for(let j = 0; j < h; j++){
		for(let i = 0; i < w; i++){
			const x = i * scale + offX,
				y = j * scale + offY,
				idx = points.length;
			
			hash.addPoint(x, y, idx);
			points.push(x, y);
		}
	}
	
	return {hash, points};
}

function testExact(t, points, hash, samples, scale){
	for(let i = 0; i < points.length; i += 2){
		const x = points[i],
			y = points[i + 1],
			found = hash.findPoint(x, y);
		
		if(!found || found[0] !== x || found[1] !== y || found[2] !== i){
			t.fail(`found ${found} instead of [${x}, ${y}, ${i}]`);
		}
	}
	
	for(let i = 0; i < samples; i++){
		const idx = (Math.random() * (points.length / 2)) | 0,
			x = points[idx * 2] + scale / 2,
			y = points[idx * 2 + 1] + scale / 2,
			found = hash.findPoint(x, y);
		
		if(found && found[2] === idx){
			t.fail(`shouldn't have found ${found} by (${x}, ${y})`);
		}
	}
	
	t.pass("found all points exactly");
}

function testSample(t, points, hash, count, scale, radius){
	const r2 = radius * radius;
	for(let i = 0; i < count; i++){
		const cx = Math.random() * scale,
			cy = Math.random() * scale,
			ref = new Set;
		
		for(let i = 0; i < points.length; i += 2){
			const x = points[i],
				y = points[i + 1];
			
			if(sqdist(cx, cy, x, y) <= r2){
				ref.add(i);
			}
		}
		
		const need = ref.size;
		
		for(const [x, y, idx] of hash.nearbyPoints(cx, cy, radius)){
			if(!ref.has(idx)){
				t.fail(`found invalid point [${x}, ${y}, ${idx}]`);
			}
			ref.delete(idx);
		}
		
		t.equal(ref.size, 0, `found ${need} points within circle`);
	}
	
	t.pass("found all samples");
}

function testSegment(t, points, hash, count, scale, radius){
	// pointsNearSegment not defined for radius > cellSize
	if(radius > hash.cellSize){
		t.pass(`ignore radius ${radius} > cellSize ${hash.cellSize}`);
		return;
	}
	
	const r2 = radius * radius;
	for(let i = 0; i < count; i++){
		const x1 = Math.random() * scale,
			y1 = Math.random() * scale,
			x2 = Math.random() * scale,
			y2 = Math.random() * scale,
			ref = new Set;
		
		for(let i = 0; i < points.length; i += 2){
			const x = points[i],
				y = points[i + 1];
			
			if(segPointDistSq(x1, y1, x2, y2, x, y) <= r2){
				ref.add(i);
			}
		}
		
		const need = ref.size;
		
		for(const [x, y, idx] of hash.pointsNearSegment(x1, y1, x2, y2, radius)){
			if(!ref.has(idx)){
				t.fail(`found invalid point [${x}, ${y}, ${idx}]`);
			}
			ref.delete(idx);
		}
		
		t.equal(ref.size, 0, `found ${need} points under segment`);
	}
	
	t.pass("found all samples");
}

function testRemove(t, points, hash, samples, scale){
	const numPoints = points.length / 2;
	// remove non-existent points
	for(let i = 0; i < samples; i++){
		const idx = ((numPoints * Math.random()) | 0) * 2,
			x = points[idx] + scale / 2,
			y = points[idx + 1] + scale / 2,
			ret = hash.removePoint(x, y);
		
		if(ret !== undefined){
			t.fail(`should have removed & returned nothing, but got: ${ret}`);
		}
	}
	
	testExact(t, points, hash, samples, scale);
	
	const removed = new Set;
	for(let i = 0; i < samples; i++){
		const idx = ((numPoints * Math.random()) | 0) * 2;
		if(removed.has(idx)){
			continue;
		}
		removed.add(idx);
		
		const x = points[idx],
			y = points[idx + 1],
			ret = hash.removePoint(x, y);
		
		if(ret === undefined){
			t.fail(`should have removed & returned [${x}, ${y}, ${idx}], but got undefined`);
		}
		
		t.deepEqual(ret, [x, y, idx], `returned the removed point`);
		t.equal(hash.findPoint(x, y), undefined, `can no longer find the removed point`);
		
		const sz = hash.cellSize,
			cx = (x / sz) | 0,
			cy = (y / sz) | 0,
			key = cx + ',' + cy,
			arr = hash.map[key];
		
		t.assert(!arr || arr.length, `grid cell is cleared or has at least 1 element: ${arr && arr.length}`);
	}
}

function testPoints(t, points, hash, samples, scale, radius){
	testExact(t, points, hash, samples, scale);
	testSample(t, points, hash, samples, scale, radius);
	testSegment(t, points, hash, samples, scale, radius);
	// remove should be last
	testRemove(t, points, hash, samples, scale);
	t.pass(`passed: ${util.inspect(occupancy(hash))}`);
	t.end();
}

function testExample(t){
	const cellSize = 10,
		hash = new PointHash(cellSize); // store points in grid cells of 10x10
	
	hash.addPoint(12, 14, "foo") // store a point at (12, 14) with value "foo"
		.addPoint(5, 13, "bar")
		.addPoint(18, 19, "baz")
		.addPoint(6, 7, "quux")
		.addPoint(18, 9, "alpha")
		.addPoint(5, 21, "bravo")
		.addPoint(20, 16, "charlie")
		.addPoint(21, 19, "delta");
	
	t.deepEqual(hash.findPoint(5, 13), [5, 13, "bar"], "finds existing point");
	t.equal(hash.findPoint(18, 20), undefined, "doesn't find non-existing point");
	
	const ref = new Set(["charlie", "baz", "delta"]);
	// find points within a radius of 4 around (20, 18)
	for(const [x, y, name] of hash.nearbyPoints(20, 18, 4)){
		t.assert(ref.has(name), `found nearby point ${name}`);
		ref.delete(name);
	}
	
	t.equal(ref.size, 0, "found all nearby points");
	
	const refSeg = new Set(["bravo", "foo", "alpha"]);
	// find points within 2 units around line segment (4, 22) - (19, 8)
	for(const [x, y, name] of hash.pointsNearSegment(4, 22, 19, 8, 2)){
		t.assert(refSeg.has(name), `found point under segment: ${name}`);
		refSeg.delete(name);
	}
	
	t.equal(ref.size, 0, "found all points under segment");
	
	t.end();
}

function testDuplicates(t){
	const cellSize = 10,
		hash = new PointHash(cellSize);
	
	hash.addPoint(2, 2, "foo");
	hash.addPoint(2, 2, "bar");
	hash.addPoint(2, 2, "qux");
	
	const ref = new Set(["foo", "bar", "qux"]);
	ref.delete(hash.removePoint(2, 2)[2]);
	ref.delete(hash.removePoint(2, 2)[2]);
	ref.delete(hash.removePoint(2, 2)[2]);
	
	t.equal(ref.size, 0, "found all points to delete");
	t.equal(hash.removePoint(2, 2), undefined, "can no longer find deleted points");
	
	t.end();
}

const randoms = [
	{count: 1000, cellSize: 10, scale: 50, samples: 100, radius: 10},
	{count: 1000, cellSize: 100, scale: 50, samples: 100, radius: 10},
	{count: 1000, cellSize: 1000, scale: 50, samples: 100, radius: 10},
	{count: 1000, cellSize: 10, scale: 1000, samples: 100, radius: 10},
	{count: 1000, cellSize: 10, scale: 10000, samples: 100, radius: 10},
	{count: 1000, cellSize: 10, scale: 50, samples: 100, radius: 100},
	{count: 1000, cellSize: 10, scale: 50, samples: 100, radius: 1000}
], grids = [
	{scale: 100, cellSize: 10, w: 100, h: 100, offX: 0, offY: 0, samples: 100, radius: 200},
	{scale: 100, cellSize: 10, w: 100, h: 100, offX: 50, offY: 50, samples: 100, radius: 200},
	{scale: 100, cellSize: 10, w: 100, h: 100, offX: 99, offY: 99, samples: 100, radius: 200},
	{scale: 100, cellSize: 100, w: 100, h: 100, offX: 0, offY: 0, samples: 100, radius: 200},
	{scale: 100, cellSize: 100, w: 100, h: 100, offX: 50, offY: 50, samples: 100, radius: 200},
	{scale: 100, cellSize: 100, w: 100, h: 100, offX: 99, offY: 99, samples: 100, radius: 200},
	{scale: 100, cellSize: 1000, w: 100, h: 100, offX: 0, offY: 0, samples: 100, radius: 200},
	{scale: 100, cellSize: 1000, w: 100, h: 100, offX: 50, offY: 50, samples: 100, radius: 200},
	{scale: 100, cellSize: 1000, w: 100, h: 100, offX: 99, offY: 99, samples: 100, radius: 200},
];

function main(args){
	tape.test("Example", testExample);
	tape.test("Duplicates", testDuplicates);
	
	for(const cfg of randoms){
		const {count, cellSize, scale, samples, radius} = cfg,
			hash = new PointHash(cellSize),
			{points} = genRandom(hash, count, scale);
		tape.test(`random: ${count} pts, cellSize: ${cellSize}, scale: ${scale}`,
				(t) => testPoints(t, points, hash, samples, scale, radius));
	}
	
	for(const cfg of grids){
		const {scale, cellSize, w, h, offX, offY, samples, radius} = cfg,
			hash = new PointHash(cellSize),
			{points} = genGrid(hash, scale, w, h, offX, offY);
		
		tape.test(`grid: (${w}, ${h}) * ${scale} + (${offX}, ${offY}), cellSize: ${cellSize}`,
				(t) => testPoints(t, points, hash, samples, scale, radius));
	}
}

main(process.argv.slice(2));
