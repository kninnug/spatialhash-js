import {SegmentHash, intersectSegments} from './SpatialHash.mjs';
import util from 'util';
import tape from 'tape';

function occupancy(hash){
	let activeCells = 0,
		empty = 0,
		segments = 0,
		min = Infinity,
		max = -Infinity;
	
	for(const [key, arr] of Object.entries(hash.map)){
		if(!arr || !arr.length){
			empty++;
			continue;
		}
		
		activeCells++;
		const len = arr.length / 5;
		min = Math.min(min, len);
		max = Math.max(max, len);
		segments += len;
	}
	
	return {
		min,
		max,
		activeCells,
		segments,
		mean: segments / activeCells
	}
}

function genRandom(hash, count, scale){
	const segments = [];
	
	for(let i = 0; i < count; i++){
		const x1 = Math.random() * scale,
			y1 = Math.random() * scale,
			x2 = Math.random() * scale,
			y2 = Math.random() * scale,
			idx = segments.length;
		
		hash.addSegment(x1, y1, x2, y2, idx);
		segments.push(x1, y1, x2, y2);
	}
	
	return {hash, segments};
}

function testExact(t, segments, hash, samples, scale){
	for(let i = 0; i < segments.length; i += 4){
		const x1 = segments[i],
			y1 = segments[i + 1],
			x2 = segments[i + 2],
			y2 = segments[i + 3],
			found = hash.findSegment(x1, y1, x2, y2, 0);
		
		if(!found || found[0] !== x1 || found[1] !== y1 || found[2] !== x2 || found[3] !== y2 || found[4] !== i){
			t.fail(`found ${found} instead of [${x1}, ${y1}, ${x2}, ${y2}, ${i}]`);
		}
	}
	
	for(let i = 0; i < samples; i++){
		const idx = (Math.random() * (segments.length / 2)) | 0,
			x1 = segments[i] + scale / 2,
			y1 = segments[i] + scale / 2,
			x2 = segments[i] + scale / 2,
			y2 = segments[i] + scale / 2,
			found = hash.findSegment(x1, y1, x2, y2, 0);
		
		if(found && found[4] === idx){
			t.fail(`shouldn't have found ${found} at [(${x1}, ${y1}), (${x2}, ${y2})]`);
		}
	}
	
	t.pass("found all segments exactly");
}

function testIntersects(t, segments, hash, count, scale){
	for(let i = 0; i < count; i++){
		const x1 = Math.random() * scale,
			y1 = Math.random() * scale,
			x2 = Math.random() * scale,
			y2 = Math.random() * scale,
			ref = new Set;
		
		for(let i = 0; i < segments.length; i += 4){
			const sx1 = segments[i],
				sy1 = segments[i + 1],
				sx2 = segments[i + 2],
				sy2 = segments[i + 3];
			
			if(intersectSegments(x1, y1, x2, y2, sx1, sy1, sx2, sy2)){
				ref.add(i);
			}
		}
		
		const need = ref.size,
			found = new Set;
		
		for(let [sx1, sy1, sx2, sy2, idx] of hash.findIntersects(x1, y1, x2, y2, 0)){
			if(found.has(idx)){
				//t.fail(`found duplicate segment ${idx}`);
			}else if(!ref.has(idx)){
				t.fail(`found invalid segment [${sx1}, ${sy1}, ${sx2}, ${sy2}, ${idx}]`);
			}
			ref.delete(idx);
			found.add(idx);
		}
		
		t.equal(ref.size, 0, `found ${need} intersects`);
	}
}

function testRemove(t, segments, hash, samples, scale){
	const numSegments = segments.length / 4;
	// remove non-existent segments
	for(let i = 0; i < samples; i++){
		const idx = ((numSegments * Math.random()) | 0) * 4,
			x1 = segments[idx] + scale / 2,
			y1 = segments[idx + 1] + scale / 2,
			x2 = segments[idx + 2] + scale / 2,
			y2 = segments[idx + 3] + scale / 2,
			ret = hash.removeSegment(x1, y1, x2, y2);
		
		if(ret !== undefined){
			t.fail(`should have removed & returned nothing, but got: ${ret}`);
		}
	}
	
	testExact(t, segments, hash, samples, scale);
	
	const removed = new Set;
	for(let i = 0; i < samples; i++){
		const idx = ((numSegments * Math.random()) | 0) * 4;
		if(removed.has(idx)){
			continue;
		}
		removed.add(idx);
		
		const x1 = segments[idx],
			y1 = segments[idx + 1],
			x2 = segments[idx + 2],
			y2 = segments[idx + 3],
			ret = hash.removeSegment(x1, y1, x2, y2);
		
		if(ret === undefined){
			t.fail(`should have removed & returned [${x1}, ${y1}, ${x2}, ${y2}, ${idx}], but got undefined`);
		}
		
		t.deepEqual(ret, [x1, y1, x2, y2, idx], `returned the removed segment`);
		t.equal(hash.findSegment(x1, y1, x2, y2), undefined, `can no longer find the removed segment`);
		
		const sz = hash.cellSize,
			cx = (x1 / sz) | 0,
			cy = (y1 / sz) | 0,
			key = cx + ',' + cy,
			arr = hash.map[key];
		
		t.assert(!arr || arr.length, `grid cell is cleared or has at least 1 element: ${arr && arr.length}`);
	}
}

function testSegments(t, segments, hash, samples, scale){
	testExact(t, segments, hash, samples, scale);
	testIntersects(t, segments, hash, samples, scale);
	testRemove(t, segments, hash, samples, scale);
	t.pass(`passed: ${util.inspect(occupancy(hash))}`);
	t.end();
}

function testExample(t){
	const cellSize = 10,
		sgHash = new SegmentHash(cellSize); // store segments in cells of 10x10
	
	sgHash.addSegment(7, 7, 9, 28, "foo") // add segment (7, 7) to (9, 28) with value "foo"
		.addSegment(16, 9, 15, 26, "bar")
		.addSegment(19, 6, 26, 25, "quux");
	
	sgHash.findSegment(7, 7, 9, 28); // = [7, 7, 9, 28, "foo"] find segment exactly
	sgHash.findSegment(15, 9, 15, 26); // = undefined
	
	const ref = new Set(["bar", "quux"]),
		found = new Set;
	// find the two segments that intersect with (11, 19) to (25, 16)
	for(const [x1, y1, x2, y2, name] of sgHash.findIntersects(11, 19, 25, 16)){
		t.assert(ref.has(name) || found.has(name), `found intersect ${name}`);
		ref.delete(name);
		found.add(name);
	}
	
	t.equal(ref.size, 0, `found all intersects`);
	t.end();
}

function testDuplicates(t){
	const cellSize = 10,
		hash = new SegmentHash(cellSize);
	
	hash.addSegment(2, 2, 3, 3, "foo");
	hash.addSegment(2, 2, 3, 3, "bar");
	hash.addSegment(2, 2, 3, 3, "qux");
	
	const ref = new Set(["foo", "bar", "qux"]);
	ref.delete(hash.removeSegment(2, 2, 3, 3)[4]);
	ref.delete(hash.removeSegment(2, 2, 3, 3)[4]);
	ref.delete(hash.removeSegment(2, 2, 3, 3)[4]);
	
	t.equal(ref.size, 0, "found all segments to delete");
	t.equal(hash.removeSegment(2, 2, 3, 3), undefined, "can no longer find deleted segments");
	
	t.end();
}

const randoms = [
	{count: 1000, scale: 100, cellSize: 10, samples: 100},
	{count: 1000, scale: 100, cellSize: 100, samples: 100},
	{count: 1000, scale: 100, cellSize: 1000, samples: 100},
	{count: 1000, scale: 1000, cellSize: 10, samples: 100},
	{count: 1000, scale: 10000, cellSize: 10, samples: 100}
];

function main(args){
	tape.test("Example", testExample);
	tape.test("Duplicates", testDuplicates);
	
	for(const cfg of randoms){
		const {count, scale, cellSize, samples} = cfg,
			hash = new SegmentHash(cellSize),
			{segments} = genRandom(hash, count, scale);
		
		tape.test(`random: ${count} segments, cellSize: ${cellSize}, scale: ${scale}`,
				(t) => testSegments(t, segments, hash, samples, scale));
	}
}

main(process.argv.slice(2));
