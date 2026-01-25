# Find all leaf nodes (stories not depended on by anything except STORY-8.1.1)
[.stories[] | select(.phase != 8) | .id] as $all_ids |
[.stories[] | select(.id != "STORY-8.1.1") | .depends_on // [] | .[]] | unique as $depended_on |
[$all_ids[] | select(. as $id | $depended_on | index($id) | not)] | sort as $all_leaves |

# Update STORY-8.1.1 to depend on all leaves
(.stories[] | select(.id == "STORY-8.1.1")).depends_on = $all_leaves
