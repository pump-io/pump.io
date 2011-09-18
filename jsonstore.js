// jsonstore.js
//
// abstraction for storing JSON data in some kinda storage
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

function JSONStoreException(message)
{
    this.message = message;
}

function JSONStore
{
}

JSONStore.prototype.create = function(type, id, value)
{
    throw new JSONStoreException("create() method unimplemented.");
}

JSONStore.prototype.read = function(type, id)
{
    throw new JSONStoreException("read() method unimplemented.");
}

JSONStore.prototype.update = function(type, id, value)
{
    throw new JSONStoreException("update() method unimplemented.");
}

JSONStore.prototype.del = function(type, id)
{
    throw new JSONStoreException("del() method unimplemented.");
}

JSONStore.prototype.search = function(type, criteria)
{
    throw new JSONStoreException("search() method unimplemented.");
}
