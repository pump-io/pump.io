// audio.js
//
// An edge in the social graph, from follower to followed
//
// Copyright 2011, StatusNet Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var DatabankObject = require('databank').DatabankObject;

var Edge = DatabankObject.subClass('edge');

exports.Edge = Edge;

Edge.schema = { pkey: 'id', 
		fields: ['from',
			 'to',
			 'published',
			 'updated'],
		indices: ['from.id', 'to.id'] };
