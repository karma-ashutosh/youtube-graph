#!/usr/bin/env python3
"""
Filter segments to keep only those with transcripts.
Removes segments that don't have transcript data.
"""

import json
import sys

def filter_segments_with_transcripts(input_file, output_file):
    """
    Read segments from input_file, filter to keep only those with transcripts,
    and write to output_file.
    """
    print(f"Reading segments from: {input_file}")

    with open(input_file, 'r') as f:
        segments = json.load(f)

    print(f"Total segments loaded: {len(segments)}")

    # Filter segments that have both transcript and analysis
    filtered = []
    for seg in segments:
        has_transcript = seg.get('transcript') is not None and seg.get('transcript') != ""
        has_analysis = seg.get('analysis_json') is not None

        if has_transcript and has_analysis:
            filtered.append(seg)
        elif has_transcript and not has_analysis:
            print(f"  ⚠️  Segment {seg['id']} has transcript but no analysis - skipping")
        elif has_analysis and not has_transcript:
            print(f"  ⚠️  Segment {seg['id']} has analysis but no transcript - skipping")

    print(f"\nSegments with both transcript and analysis: {len(filtered)}")

    if filtered:
        print(f"\nKept segments: {[s['id'] for s in filtered]}")

        # Write to output file
        with open(output_file, 'w') as f:
            json.dump(filtered, f, indent=2)

        print(f"\n✅ Filtered segments written to: {output_file}")

        # Print summary stats
        print("\n=== SUMMARY ===")
        for seg in filtered:
            analysis = seg['analysis_json']
            print(f"\nSegment {seg['id']}: {seg['start_time']} - {seg['end_time']}")
            print(f"  Topic: {seg['topic_hint'][:80]}...")
            print(f"  Transcript: {len(seg['transcript'])} chars")
            print(f"  Examples: {len(analysis.get('examples', []))}")
            print(f"  Key Ideas: {len(analysis.get('key_ideas', []))}")
            print(f"  Primary Concept: {analysis.get('primary_concept', {}).get('name')}")
            print(f"  Supporting: {len(analysis.get('supporting_concepts', []))}")
            print(f"  Mentioned: {len(analysis.get('mentioned_concepts', []))}")
    else:
        print("\n❌ No segments found with both transcript and analysis!")
        sys.exit(1)

if __name__ == '__main__':
    input_file = '/Users/karma/code/youtube-graph/test_content_segment.json'
    output_file = '/Users/karma/code/youtube-graph/filtered_segments_with_transcript.json'

    filter_segments_with_transcripts(input_file, output_file)
